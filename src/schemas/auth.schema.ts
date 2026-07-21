import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'البريد الإلكتروني أو اسم المستخدم مطلوب'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

export const pushTokenSchema = z.object({
  expoPushToken: z.string().min(1, 'رمز الإشعارات مطلوب'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type PushTokenInput = z.infer<typeof pushTokenSchema>;
