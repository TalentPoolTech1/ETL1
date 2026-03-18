import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError, AppErrors } from '@shared/errors';

/**
 * Authentication middleware.
 * 
 * Logic:
 * 1. Checks for 'Authorization: Bearer <token>'
 * 2. In DEVELOPMENT mode, allows 'X-Mock-User-ID' skip.
 * 3. Verifies JWT using APP_JWT_SECRET (fallback to dev secret).
 * 4. Injects decoded userId into req.user.
 */
export async function authGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const isDev = process.env.NODE_ENV === 'development';
  const mockUserId = req.headers['x-mock-user-id'] as string;

  // 1. Development Bypass
  if (isDev && mockUserId) {
    (req as any).user = { userId: mockUserId };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(AppErrors.usr.unauthorized('No authentication token provided'));
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.APP_JWT_SECRET || 'dev-secret-keep-it-safe';

  try {
    const decoded = jwt.verify(token, secret) as { sub: string; userId?: string };
    
    // We expect the 'sub' or a 'userId' claim to contain the ETL1 User UUID
    const userId = decoded.userId || decoded.sub;

    if (!userId) {
      return next(AppErrors.usr.unauthorized('Invalid token payload: missing userId/sub'));
    }

    (req as any).user = { userId };
    next();
  } catch (err) {
    next(AppErrors.usr.unauthorized('Invalid or expired token', { cause: err }));
  }
}
