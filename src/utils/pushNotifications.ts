import { prisma } from '../lib/prisma';

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export async function sendExpoPushNotifications(
  tokens: string[],
  payload: PushPayload,
): Promise<void> {
  const uniqueTokens = [...new Set(tokens.filter(Boolean))];
  if (uniqueTokens.length === 0) return;

  const messages = uniqueTokens.map((to) => ({
    to,
    sound: 'default' as const,
    title: payload.title,
    body: payload.body,
    data: payload.data,
  }));

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Expo push failed:', text);
  }
}

export async function notifyAdminsNewOrder(order: {
  id: string;
  orderNumber: string;
  totalAmount: unknown;
}): Promise<void> {
  const admins = await prisma.user.findMany({
    where: {
      role: 'ADMIN',
      isActive: true,
      expoPushToken: { not: null },
    },
    select: { expoPushToken: true },
  });

  const tokens = admins
    .map((admin) => admin.expoPushToken)
    .filter((token): token is string => Boolean(token));

  await sendExpoPushNotifications(tokens, {
    title: 'طلب جديد',
    body: `طلب ${order.orderNumber} بقيمة ${Number(order.totalAmount).toFixed(0)} ر.س`,
    data: { orderId: order.id, type: 'NEW_ORDER' },
  });
}
