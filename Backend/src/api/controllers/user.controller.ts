import { Request, Response, NextFunction } from 'express';
import { db } from '../../db/connection';
import { AppErrors } from '@shared/errors';

export class UserController {
  /**
   * getMe — Returns the current authenticated user's profile and permissions.
   */
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    const user = (req as any).user;

    if (!user || !user.userId) {
      return next(AppErrors.usr.unauthorized('Not authenticated'));
    }

    try {
      // 1. Fetch user details from etl.users
      const userData = await db.queryOne(
        `SELECT user_id, email_address, user_full_name, user_role_code 
         FROM etl.users WHERE user_id = $1`,
        [user.userId]
      );

      if (!userData) {
        return next(AppErrors.usr.notFound(user.userId));
      }

      // 2. Fetch effective permissions via gov schema
      const permissions = await db.queryMany<{ perm_code_name: string }>(
        `SELECT perm_code_name FROM gov.fn_get_user_permissions($1)`,
        [user.userId]
      );

      res.json({
        success: true,
        data: {
          user: {
            id: userData['user_id'],
            email: userData['email_address'],
            fullName: userData['user_full_name'],
            role: userData['user_role_code'],
          },
          permissions: permissions.map(p => p.perm_code_name)
        }
      });
    } catch (err) {
      next(AppErrors.usr.unexpected(err as Error));
    }
  }
}

export const userController = new UserController();
