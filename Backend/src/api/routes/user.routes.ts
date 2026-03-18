import { Router } from 'express';
import { userController as ctrl } from '../controllers/user.controller';

const router = Router();

/**
 * GET /api/me
 * Returns current authenticated user metadata and effective RBAC permissions.
 */
router.get('/me', (req, res, next) => ctrl.getMe(req, res, next));

export { router as userRouter };
