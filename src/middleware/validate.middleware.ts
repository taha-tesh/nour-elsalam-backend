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

    // Express 5: req.query/params are read-only — store parsed values separately
    if (target === 'body') {
      req.body = result.data;
    } else if (target === 'query') {
      req.validatedQuery = result.data as Record<string, unknown>;
    } else {
      req.validatedParams = result.data as Record<string, unknown>;
    }
    next();
  };
}

function formatZodError(error: ZodError): string {
  const first = error.errors[0];
  return first?.message ?? 'Invalid data provided';
}
