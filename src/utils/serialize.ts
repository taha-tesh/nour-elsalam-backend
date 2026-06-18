import { Decimal } from '@prisma/client/runtime/library';

export function toNumber(value: Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : Number(value);
}

export function serializeProduct<T extends Record<string, unknown>>(product: T) {
  return {
    ...product,
    price: toNumber(product.price as Decimal),
  };
}

export function serializeOrder<T extends Record<string, unknown>>(order: T) {
  const items = order.items as Array<Record<string, unknown>> | undefined;
  return {
    ...order,
    totalAmount: toNumber(order.totalAmount as Decimal),
    items: items?.map((item) => ({
      ...item,
      unitPrice: toNumber(item.unitPrice as Decimal),
    })),
  };
}
