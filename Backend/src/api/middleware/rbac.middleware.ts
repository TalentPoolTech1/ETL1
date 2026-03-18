import { Request, Response, NextFunction } from 'express';
import { db } from '../../db/connection';
import { AppErrors } from '@shared/errors';

/**
 * requirePermission — Permission-based authorization guard.
 * 
 * Logic:
 * 1. Checks if the user is authenticated (via authGuard).
 * 2. Queries gov.fn_check_permission(userId, permissionCode) in the DB.
 * 3. Continues if the user holds the permission via ANY assigned role.
 * 4. Yields USR-009 (Forbidden) if unauthorized.
 * 
 * Usage:
 * router.post('/', requirePermission('PIPELINE_CREATE'), (req, res) => { ... });
 */
export function requirePermission(permissionCode: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = (req as any).user;

    // 1. Safety Check: Must be authenticated
    if (!user || !user.userId) {
      return next(AppErrors.usr.unauthorized('Authorization check failed: User identity missing from request. Ensure authGuard is executed first.'));
    }

    try {
      // 2. Database Check (Atomic check via gov schema logic)
      const result = await db.queryOne<{ has_perm: boolean }>(
        `SELECT gov.fn_check_permission($1::UUID, $2::TEXT) AS has_perm`,
        [user.userId, permissionCode]
      );

      if (result?.has_perm) {
        return next();
      }

      // 3. Unauthorized: Map to 403 Forbidden
      next(AppErrors.usr.forbidden());
    } catch (err) {
      // Handle database connectivity or UUID casting errors
      next(AppErrors.usr.unexpected(err as Error));
    }
  };
}
