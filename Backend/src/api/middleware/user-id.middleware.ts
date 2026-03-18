import { Request, Response, NextFunction } from 'express';

export function userIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const userId = (req as any).user?.userId;
    res.locals['userId'] = (typeof userId === 'string' && userId.trim()) ? userId.trim() : 'system';
    next();
}
