import { Request } from 'express';
import { AuthUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Parsed query after Zod validation (Express 5 compatible) */
      validatedQuery?: Record<string, unknown>;
      validatedParams?: Record<string, unknown>;
    }
  }
}

export {};
