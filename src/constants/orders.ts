import { OrderStatus } from '@prisma/client';

/** Arabic labels for order statuses (matches Stitch tracking UI) */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  RECEIVED: 'تم استلام الطلب',
  PROCESSING: 'قيد التجهيز',
  OUT_FOR_DELIVERY: 'قيد التوصيل',
  DELIVERED: 'تم التسليم',
};

/** Valid status transitions (admin can move forward; delivered is terminal) */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  OrderStatus.RECEIVED,
  OrderStatus.PROCESSING,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

export function getNextStatuses(current: OrderStatus): OrderStatus[] {
  const idx = ORDER_STATUS_FLOW.indexOf(current);
  if (idx === -1) return [];
  return ORDER_STATUS_FLOW.slice(idx);
}
