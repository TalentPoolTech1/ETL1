import { Request, Response, NextFunction } from 'express';

/**
 * userIdMiddleware — extracts the X-User-Id request header and attaches it
 * to `res.locals.userId` for downstream controllers.
 *
 * Controllers read: `res.locals.userId as string`
 *
 * In a production deployment this header would be validated against a signed
 * JWT or session token by an upstream auth gateway.  For the platform's
 * current trust model the API gateway is responsible for identity; this
 * middleware simply surfaces the value.
 */
export function userIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const userId = req.headers['x-user-id'];
    if (typeof userId === 'string' && userId.trim()) {
        res.locals['userId'] = userId.trim();
    } else {
        // Default system user when caller omits the header (e.g. health checks,
        // internal service-to-service calls).  Controllers that require a real
        // user identity must validate this value before proceeding.
        res.locals['userId'] = 'system';
    }
    next();
}
