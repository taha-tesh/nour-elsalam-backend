import { prisma } from '../lib/prisma';

export async function generateOrderNumber(): Promise<string> {
  const count = await prisma.order.count();
  const next = count + 1;
  return `ORD-${String(next).padStart(5, '0')}`;
}
