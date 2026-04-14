// account.routes.ts - Updated with email notifications
import { Router, Request, Response } from 'express';
// @ts-ignore
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import {
  sendPasswordChangedEmail,
  sendDeletionRequestedEmail,
  sendDeletionCancelledEmail
} from '../services/security-emails';

const router = Router();
const db = prisma as any;

// All routes require authentication
router.use(authenticateToken);

// POST /api/account/request-deletion - Request account deletion
router.post('/request-deletion', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { password, reason, feedback } = req.body;

    // Get user
    const user = await db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Check if deletion already requested
    const existingDeletion = await db.accountDeletion.findUnique({
      where: { userId }
    });

    if (existingDeletion && existingDeletion.status === 'PENDING') {
      return res.status(400).json({ error: 'Deletion already requested' });
    }

    // Calculate scheduled deletion date (30 days from now)
    const scheduledDeletionDate = new Date();
    scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + 30);

    // Create or update deletion request
    const deletion = await db.accountDeletion.upsert({
      where: { userId },
      create: {
        userId,
        reason,
        feedback,
        scheduledDeletionDate,
        status: 'PENDING'
      },
      update: {
        reason,
        feedback,
        scheduledDeletionDate,
        requestedAt: new Date(),
        cancelledAt: null,
        status: 'PENDING'
      }
    });

    // Log activity
    await db.accountActivityLog.create({
      data: {
        userId,
        action: 'ACCOUNT_DELETION_REQUESTED',
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent'],
        details: JSON.stringify({ scheduledDeletionDate })
      }
    });

    // Send email notification
    await sendDeletionRequestedEmail({
      email: user.email,
      firstName: user.firstName,
      scheduledDate: scheduledDeletionDate,
      ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
      timestamp: new Date()
    });

    res.json({
      message: 'Account deletion requested',
      scheduledDeletionDate,
      deletion
    });
  } catch (error: any) {
    console.error('Request deletion error:', error);
    res.status(500).json({ error: 'Failed to request deletion' });
  }
});

// POST /api/account/cancel-deletion - Cancel pending deletion
router.post('/cancel-deletion', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const deletion = await db.accountDeletion.findUnique({
      where: { userId }
    });

    if (!deletion || deletion.status !== 'PENDING') {
      return res.status(404).json({ error: 'No pending deletion request found' });
    }

    // Get user for email
    const user = await db.user.findUnique({
      where: { id: userId }
    });

    // Cancel the deletion
    await db.accountDeletion.update({
      where: { userId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date()
      }
    });

    // Log activity
    await db.accountActivityLog.create({
      data: {
        userId,
        action: 'ACCOUNT_DELETION_CANCELLED',
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent']
      }
    });

    // Send confirmation email
    if (user) {
      await sendDeletionCancelledEmail({
        email: user.email,
        firstName: user.firstName,
        timestamp: new Date()
      });
    }

    res.json({ message: 'Account deletion cancelled' });
  } catch (error: any) {
    console.error('Cancel deletion error:', error);
    res.status(500).json({ error: 'Failed to cancel deletion' });
  }
});

// GET /api/account/deletion-status - Get deletion status
router.get('/deletion-status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const deletion = await db.accountDeletion.findUnique({
      where: { userId }
    });

    if (!deletion || deletion.status !== 'PENDING') {
      return res.json({ hasPendingDeletion: false });
    }

    const now = new Date();
    const daysRemaining = Math.ceil(
      (deletion.scheduledDeletionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    res.json({
      hasPendingDeletion: true,
      requestedAt: deletion.requestedAt,
      scheduledDeletionDate: deletion.scheduledDeletionDate,
      daysRemaining
    });
  } catch (error: any) {
    console.error('Get deletion status error:', error);
    res.status(500).json({ error: 'Failed to get deletion status' });
  }
});

// POST /api/account/request-email-verification - Request email verification for sensitive changes
router.post('/request-email-verification', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { type, newEmail } = req.body;

    const user = await db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    // Create verification record
    await db.emailVerification.create({
      data: {
        userId,
        email: newEmail || user.email,
        token,
        type: type || 'SENSITIVE_ACTION',
        expiresAt
      }
    });

    // TODO: Send verification email with token
    // For now, return the token (in production, only send via email)
    res.json({
      message: 'Verification email sent',
      // Remove this in production - only for testing
      token: process.env.NODE_ENV === 'development' ? token : undefined
    });
  } catch (error: any) {
    console.error('Request email verification error:', error);
    res.status(500).json({ error: 'Failed to request verification' });
  }
});

// POST /api/account/verify-email - Verify email token
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { token } = req.body;

    const verification = await db.emailVerification.findFirst({
      where: {
        userId,
        token,
        verifiedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (!verification) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Mark as verified
    await db.emailVerification.update({
      where: { id: verification.id },
      data: { verifiedAt: new Date() }
    });

    // If this is an email change verification, update the user's email
    if (verification.type === 'EMAIL_CHANGE') {
      await db.user.update({
        where: { id: userId },
        data: { email: verification.email }
      });

      // Log activity
      await db.accountActivityLog.create({
        data: {
          userId,
          action: 'EMAIL_CHANGED',
          ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
          userAgent: req.headers['user-agent'],
          details: JSON.stringify({ newEmail: verification.email })
        }
      });
    }

    res.json({ message: 'Email verified successfully', type: verification.type });
  } catch (error: any) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// PUT /api/account/change-password - Change password
router.put('/change-password', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const user = await db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      // Log failed attempt
      await db.accountActivityLog.create({
        data: {
          userId,
          action: 'PASSWORD_CHANGE_FAILED',
          ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
          userAgent: req.headers['user-agent'],
          details: JSON.stringify({ reason: 'Invalid current password' })
        }
      });

      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    // Log activity
    await db.accountActivityLog.create({
      data: {
        userId,
        action: 'PASSWORD_CHANGED',
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent']
      }
    });

    // Send email notification
    await sendPasswordChangedEmail({
      email: user.email,
      firstName: user.firstName,
      ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
      userAgent: req.headers['user-agent'],
      timestamp: new Date()
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// POST /api/account/heartbeat - Update last active timestamp
router.post('/heartbeat', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    await db.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

export default router;
