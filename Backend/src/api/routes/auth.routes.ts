import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../db/connection';
import { authGuard } from '../middleware/auth.middleware';
import { AppErrors } from '@shared/errors';
import { LoggerFactory } from '../../shared/logging';

const log = LoggerFactory.get('users');

export const authRouter = Router();

// ─── Login ────────────────────────────────────────────────────────────────────

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return next(AppErrors.usr.invalidCredentials());
  }

  try {
    const user = await db.queryOne<{
      user_id: string;
      email_address: string;
      password_hash_text: string;
      user_full_name: string;
    }>(
      `SELECT user_id, email_address, password_hash_text, user_full_name
       FROM etl.fn_get_user_for_login($1)`,
      [email]
    );

    if (!user) {
      log.warn('users.login', 'Login failed: user not found or inactive', { email });
      return next(AppErrors.usr.invalidCredentials());
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash_text);
    if (!passwordMatch) {
      log.warn('users.login', 'Login failed: password mismatch', { userId: user.user_id });
      return next(AppErrors.usr.invalidCredentials());
    }

    const secret = process.env.APP_JWT_SECRET || 'dev-secret-keep-it-safe';
    const token = jwt.sign(
      { sub: user.user_id, email: user.email_address, name: user.user_full_name },
      secret,
      { expiresIn: '8h' }
    );

    await db.query(`CALL etl.pr_record_user_login($1::uuid)`, [user.user_id]);

    log.info('users.login', 'Login successful', { userId: user.user_id });

    res.json({
      success: true,
      data: {
        token,
        user: {
          userId:   user.user_id,
          email:    user.email_address,
          fullName: user.user_full_name,
        },
      },
    });
  } catch (err) {
    next(AppErrors.usr.unexpected(err as Error));
  }
});

// ─── Me ───────────────────────────────────────────────────────────────────────

authRouter.get('/me', authGuard, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = (req as any).user?.userId as string;

  try {
    const user = await db.queryOne<{
      user_id: string;
      email_address: string;
      user_full_name: string;
    }>(
      `SELECT user_id, email_address, user_full_name
       FROM etl.fn_get_active_user_by_id($1::uuid)`,
      [userId]
    );

    if (!user) {
      return next(AppErrors.usr.notFound(userId));
    }

    res.json({
      success: true,
      data: {
        userId:   user.user_id,
        email:    user.email_address,
        fullName: user.user_full_name,
      },
    });
  } catch (err) {
    next(AppErrors.usr.unexpected(err as Error));
  }
});

// ─── Change password ──────────────────────────────────────────────────────────
// Protected: caller must be authenticated. They supply their current password
// so we can verify identity before accepting the new one.

authRouter.post('/change-password', authGuard, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = (req as any).user?.userId as string;
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ success: false, userMessage: 'currentPassword and newPassword are required' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ success: false, userMessage: 'New password must be at least 8 characters' });
    return;
  }

  try {
    const user = await db.queryOne<{ user_id: string; password_hash_text: string }>(
      `SELECT user_id, password_hash_text FROM etl.fn_get_active_user_by_id($1::uuid)`,
      [userId]
    );

    if (!user) {
      return next(AppErrors.usr.notFound(userId));
    }

    const match = await bcrypt.compare(currentPassword, user.password_hash_text);
    if (!match) {
      res.status(400).json({ success: false, userMessage: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.query(`CALL etl.pr_update_user_password($1::uuid, $2)`, [userId, newHash]);

    log.info('users.password.change', 'Password changed successfully', { userId });
    res.json({ success: true });
  } catch (err) {
    next(AppErrors.usr.unexpected(err as Error));
  }
});
