import { Request, Response, NextFunction } from 'express';
import { OrderStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/errors';
import { generateOrderNumber } from '../utils/orderNumber';
import { serializeOrder } from '../utils/serialize';
import { ORDER_STATUS_LABELS } from '../constants/orders';
import {
  CreateOrderInput,
  ListOrdersQuery,
  UpdateOrderStatusInput,
  CreateFeedbackInput,
} from '../schemas/order.schema';

const orderInclude = {
  items: {
    include: {
      product: {
        select: { id: true, titleAr: true, imageUrl: true, brand: true },
      },
    },
  },
  statusLogs: { orderBy: { createdAt: 'asc' as const } },
  feedback: true,
  user: { select: { id: true, name: true, email: true, phone: true } },
};

function formatOrderResponse(order: Prisma.OrderGetPayload<{ include: typeof orderInclude }>) {
  const serialized = serializeOrder(order);
  return {
    ...serialized,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    statusLogs: order.statusLogs.map((log) => ({
      ...log,
      statusLabel: ORDER_STATUS_LABELS[log.status],
    })),
  };
}

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.body as CreateOrderInput;
    const userId = req.user!.id;

    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      throw new AppError(404, 'أحد المنتجات غير موجود', 'PRODUCT_NOT_FOUND');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of data.items) {
      const product = productMap.get(item.productId)!;
      if (product.stock < item.quantity) {
        throw new AppError(
          400,
          `الكمية المطلوبة من "${product.titleAr}" غير متوفرة (المتبقي: ${product.stock})`,
          'INSUFFICIENT_STOCK',
        );
      }
    }

    const totalAmount = data.items.reduce((sum, item) => {
      const product = productMap.get(item.productId)!;
      return sum + Number(product.price) * item.quantity;
    }, 0);

    const orderNumber = await generateOrderNumber();

    const order = await prisma.$transaction(async (tx) => {
      for (const item of data.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return tx.order.create({
        data: {
          orderNumber,
          userId,
          totalAmount,
          shippingAddress: data.shippingAddress,
          shippingCity: data.shippingCity,
          status: OrderStatus.RECEIVED,
          items: {
            create: data.items.map((item) => {
              const product = productMap.get(item.productId)!;
              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: product.price,
                productTitle: product.titleAr,
              };
            }),
          },
          statusLogs: {
            create: {
              status: OrderStatus.RECEIVED,
              note: 'تم استلام الطلب بنجاح',
            },
          },
        },
        include: orderInclude,
      });
    });

    res.status(201).json({
      message: 'تم تأكيد الطلب بنجاح',
      order: formatOrderResponse(order),
    });
  } catch (err) {
    next(err);
  }
}

export async function listOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, status, search } = req.query as unknown as ListOrdersQuery;
    const skip = (page - 1) * limit;
    const isAdmin = req.user!.role === Role.ADMIN;

    const where: Prisma.OrderWhereInput = isAdmin ? {} : { userId: req.user!.id };

    if (status) where.status = status;

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { shippingCity: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total, statusCounts] = await Promise.all([
      prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
      isAdmin
        ? prisma.order.groupBy({ by: ['status'], _count: { status: true } })
        : Promise.resolve([]),
    ]);

    const stats = isAdmin
      ? {
          total: await prisma.order.count(),
          processing: statusCounts.find((s) => s.status === OrderStatus.PROCESSING)?._count.status ?? 0,
          outForDelivery:
            statusCounts.find((s) => s.status === OrderStatus.OUT_FOR_DELIVERY)?._count.status ?? 0,
          delivered: statusCounts.find((s) => s.status === OrderStatus.DELIVERED)?._count.status ?? 0,
        }
      : undefined;

    res.json({
      orders: orders.map(formatOrderResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (err) {
    next(err);
  }
}

export async function getOrderById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const isAdmin = req.user!.role === Role.ADMIN;

    const order = await prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });

    if (!order) {
      throw new AppError(404, 'الطلب غير موجود', 'NOT_FOUND');
    }

    if (!isAdmin && order.userId !== req.user!.id) {
      throw new AppError(403, 'ليس لديك صلاحية لعرض هذا الطلب', 'FORBIDDEN');
    }

    res.json({ order: formatOrderResponse(order) });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const { status, note, shippingCompany } = req.body as UpdateOrderStatusInput;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new AppError(404, 'الطلب غير موجود', 'NOT_FOUND');
    }

    if (order.status === OrderStatus.DELIVERED && status !== OrderStatus.DELIVERED) {
      throw new AppError(400, 'لا يمكن تغيير حالة طلب تم تسليمه', 'ORDER_ALREADY_DELIVERED');
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status,
          ...(shippingCompany !== undefined && { shippingCompany }),
        },
      });

      if (status !== order.status) {
        await tx.orderStatusLog.create({
          data: {
            orderId: id,
            status,
            note: note ?? ORDER_STATUS_LABELS[status],
          },
        });
      }

      return tx.order.findUnique({
        where: { id },
        include: orderInclude,
      });
    });

    res.json({
      message: 'تم تحديث حالة الطلب بنجاح',
      order: formatOrderResponse(updated!),
    });
  } catch (err) {
    next(err);
  }
}

export async function submitFeedback(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = String(req.params.id);
    const data = req.body as CreateFeedbackInput;
    const userId = req.user!.id;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { feedback: true },
    });

    if (!order) {
      throw new AppError(404, 'الطلب غير موجود', 'NOT_FOUND');
    }

    if (order.userId !== userId) {
      throw new AppError(403, 'ليس لديك صلاحية لتقييم هذا الطلب', 'FORBIDDEN');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new AppError(400, 'يمكن إرسال التعليق فقط بعد تسليم الطلب', 'ORDER_NOT_DELIVERED');
    }

    if (order.feedback) {
      throw new AppError(409, 'تم إرسال تعليق على هذا الطلب مسبقاً', 'FEEDBACK_EXISTS');
    }

    const feedback = await prisma.orderFeedback.create({
      data: {
        orderId,
        userId,
        rating: data.rating,
        comment: data.comment,
      },
    });

    res.status(201).json({
      message: 'تم إرسال التعليق بنجاح',
      feedback,
    });
  } catch (err) {
    next(err);
  }
}

export async function getOrderFeedback(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = String(req.params.id);
    const isAdmin = req.user!.role === Role.ADMIN;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { feedback: true },
    });

    if (!order) {
      throw new AppError(404, 'الطلب غير موجود', 'NOT_FOUND');
    }

    if (!isAdmin && order.userId !== req.user!.id) {
      throw new AppError(403, 'ليس لديك صلاحية لعرض هذا الطلب', 'FORBIDDEN');
    }

    res.json({ feedback: order.feedback });
  } catch (err) {
    next(err);
  }
}
