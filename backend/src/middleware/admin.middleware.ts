import { Request, Response, NextFunction } from 'express';
import { prisma } from '../index';
const db = prisma as any;

// Admin emails that can edit/delete campgrounds
const ADMIN_EMAILS = ['wroberts82@yahoo.com', 'deanna@rvunicorn.com'];

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (!user || !ADMIN_EMAILS.includes(user.email)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error: any) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Failed to verify admin status' });
  }
};
