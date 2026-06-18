import { Request, Response, NextFunction } from 'express';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { toNumber } from '../utils/serialize';

const LOW_STOCK_THRESHOLD = 5;

const ARABIC_DAYS = ['أحد', 'اثنين', 'ثلاث', 'أربع', 'خميس', 'جمعة', 'سبت'];

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [
      todayOrders,
      yesterdayOrders,
      newOrdersToday,
      processingCount,
      lowStockProducts,
      bestSellingRaw,
      weeklyOrders,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: { gte: startOfToday, lt: startOfTomorrow } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: startOfYesterday, lt: startOfToday } },
        _sum: { totalAmount: true },
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: startOfToday, lt: startOfTomorrow },
          status: { not: OrderStatus.DELIVERED },
        },
      }),
      prisma.order.count({ where: { status: OrderStatus.PROCESSING } }),
      prisma.product.findMany({
        where: { stock: { lte: LOW_STOCK_THRESHOLD } },
        orderBy: { stock: 'asc' },
        take: 10,
        select: {
          id: true,
          titleAr: true,
          stock: true,
          imageUrl: true,
          category: { select: { nameAr: true, icon: true } },
        },
      }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: sevenDaysAgo, lt: startOfTomorrow } },
        select: { createdAt: true, totalAmount: true },
      }),
    ]);

    const productIds = bestSellingRaw.map((b) => b.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, titleAr: true, stock: true, imageUrl: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const bestSelling = bestSellingRaw.map((item) => {
      const product = productMap.get(item.productId);
      const sales = item._sum.quantity ?? 0;
      const stock = product?.stock ?? 0;

      let statusLabel = 'جيد';
      let statusColor = 'orange';
      if (sales >= 100) {
        statusLabel = 'أعلى مبيعاً';
        statusColor = 'orange';
      } else if (sales >= 50) {
        statusLabel = 'جيد جداً';
        statusColor = 'orange';
      } else if (stock >= 30) {
        statusLabel = 'ممتاز';
        statusColor = 'yellow';
      }

      return {
        productId: item.productId,
        titleAr: product?.titleAr ?? '—',
        stock,
        sales,
        imageUrl: product?.imageUrl,
        statusLabel,
        statusColor,
      };
    });

    const todaySales = toNumber(todayOrders._sum.totalAmount);
    const yesterdaySales = toNumber(yesterdayOrders._sum.totalAmount);
    const salesChangePercent =
      yesterdaySales > 0
        ? Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100)
        : todaySales > 0
          ? 100
          : 0;

    const weeklySalesMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(startOfToday);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      weeklySalesMap.set(key, 0);
    }

    for (const order of weeklyOrders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      if (weeklySalesMap.has(key)) {
        weeklySalesMap.set(key, (weeklySalesMap.get(key) ?? 0) + toNumber(order.totalAmount));
      }
    }

    const weeklySales = Array.from(weeklySalesMap.entries()).map(([date, total]) => {
      const d = new Date(date);
      return {
        date,
        day: ARABIC_DAYS[d.getDay()],
        total,
      };
    });

    res.json({
      dailySales: {
        total: todaySales,
        changePercent: salesChangePercent,
        changeLabel:
          salesChangePercent >= 0
            ? `+${salesChangePercent}% عن أمس`
            : `${salesChangePercent}% عن أمس`,
      },
      newOrders: {
        count: newOrdersToday,
        processingCount,
        label: 'جاري التجهيز',
      },
      weeklySales,
      lowStockAlerts: lowStockProducts.map((p) => ({
        ...p,
        remainingLabel: `${p.stock} قطعة متبقية`,
      })),
      bestSelling,
    });
  } catch (err) {
    next(err);
  }
}
