import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';
import { AppError } from '../utils/errors';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodTypeAny, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const message = formatZodError(result.error);
      return next(new AppError(400, message, 'VALIDATION_ERROR'));
    }

    req[target] = result.data;
    next();
  };
}

function formatZodError(error: ZodError): string {
  const first = error.errors[0];
  return first?.message ?? 'بيانات غير صالحة';
}
