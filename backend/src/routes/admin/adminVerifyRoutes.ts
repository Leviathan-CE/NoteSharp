import { Router } from 'express';
import type { Request, Response } from 'express';
import { verifyAdmin } from '../../middleware/verifyAdmin.js';
import { updateUserRole } from '../../services/fireAuth.js';

const router = Router();

/**
 * POST /api/verify-admin
 * Verifies if the current user is an admin
 * Returns 200 with user info if admin, 403 if not admin, 401 if not authenticated
 */
router.post('/verify-admin', verifyAdmin, (req: Request, res: Response) => {
  // If we get here, the user passed admin verification
  res.status(200).json({
    isAdmin: true,
    user: req.user
  });
});

/**
 * POST /api/promote-user
 * Allows an authenticated admin to update a user's role (e.g., promote to admin)
 * Body: { uid?: string, email?: string, role: string }
 */
router.post('/promote-user', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { uid, email, role } = req.body ?? {};

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    if (!uid && !email) {
      return res.status(400).json({ error: 'Either uid or email is required' });
    }

    const updatedUser = await updateUserRole({ uid, email, role });
    res.status(200).json({
      message: `User role updated to ${updatedUser.role}`,
      user: updatedUser
    });
  } catch (error: any) {
    console.error('Failed to update user role:', error);
    res.status(400).json({ error: error.message || 'Failed to update user role' });
  }
});

export default router;
