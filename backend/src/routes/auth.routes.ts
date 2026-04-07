import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth.middleware';
import { awardBadge } from '../services/badge.service';
import { sendEmail, welcomeEmail } from '../services/email-sms.service';
import crypto from 'crypto';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, username, phoneNumber, inviteToken } = req.body;

    if (!email || !password || !firstName || !lastName || !username) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        username,
        ...(phoneNumber ? { phoneNumber } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        profilePicture: true,
        createdAt: true,
        showCampingStatus: true,
      }
    });

    // Award RVUnicorn Member badge
    await awardBadge(user.id, 'rvunicorn-member');
    // Award Founding Member badge — limited to first 5,000 members
    try {
      const foundingBadge = await prisma.badge.findUnique({ where: { slug: 'founding-member' } });
      if (foundingBadge) {
        const issuedCount = await prisma.userBadge.count({ where: { badgeId: foundingBadge.id } });
        if (issuedCount < 5000) {
          const badgeNumber = issuedCount + 1;
          await prisma.userBadge.create({
            data: { userId: user.id, badgeId: foundingBadge.id, badgeNumber },
          }).catch(() => {}); // Skip if already awarded
          console.log(`[Badge] Founding Member #${badgeNumber}/5000 awarded to ${user.email}`);
        } else {
          console.log(`[Badge] Founding Member badge sold out (5000/5000) — ${user.email} missed it`);
        }
      }
    } catch (badgeErr) { console.error('Founding badge error:', badgeErr); }
    // Auto-friend Will (founder) with every new user
    try {
      const WILL_ID = 'cmlpeyk82005s3qause3sws7y';
      if (user.id !== WILL_ID) {
        await prisma.friendship.create({
          data: {
            initiatorId: WILL_ID,
            receiverId: user.id,
          }
        });
      }
    } catch (friendErr) {
      console.error('Auto-friend Will error (non-fatal):', friendErr);
    }

    // Process invite token — link new user to inviter
    if (inviteToken) {
      try {
        const invite = await prisma.invite.findUnique({ where: { token: inviteToken } });
        if (invite && invite.status === 'pending' && new Date() < invite.expiresAt) {
          await prisma.invite.update({ where: { id: invite.id }, data: { status: 'accepted', acceptedAt: new Date() } });
          // Auto-friend the inviter and new user
          await prisma.friendship.create({ data: { initiatorId: invite.senderId, receiverId: user.id, status: 'ACCEPTED' } }).catch(() => {});
          // Award Trail Blazer badge to inviter
          try { await awardBadge(invite.senderId, 'trailblazer'); } catch {}
          // Notify the inviter
          await prisma.notification.create({ data: { userId: invite.senderId, type: 'INVITE_ACCEPTED', content: `${firstName} ${lastName} joined RVUnicorn from your invite! You're now friends. 🎉`, link: `/profile/${username}` } }).catch(() => {});
          console.log(`[Invite] ${email} joined via invite from ${invite.senderId}`);
        }
      } catch (inviteErr) { console.error('Invite processing error (non-fatal):', inviteErr); }
    }

    // Send welcome email
    try {
      const emailContent = welcomeEmail({ firstName: user.firstName || 'there' });
      await sendEmail({
        to: user.email,
        ...emailContent,
      });
    } catch (emailErr) {
      console.error('Welcome email error (non-fatal):', emailErr);
    }

    // Send welcome email
    try {
      const emailContent = welcomeEmail({ firstName: user.firstName || 'there' });
      await sendEmail({
        to: user.email,
        ...emailContent,
      });
    } catch (emailErr) {
      console.error('Welcome email error (non-fatal):', emailErr);
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
      { expiresIn: '7d' }
    );

    const userResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt,
      onboardingCompleted: user.onboardingCompleted,
      onboardingCompletedAt: user.onboardingCompletedAt,
      onboardingSkippedAt: user.onboardingSkippedAt,
    };

    res.json({ user: userResponse, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        profilePicture: true,
        bio: true,
        instagramUrl: true,
        facebookUrl: true,
        twitterUrl: true,
        redditUrl: true,
        tiktokUrl: true,
        youtubeUrl: true,
        blueskyUrl: true,
        location: true,
        createdAt: true,
        showCampingStatus: true,
        isCreator: true,
        rvType: true,
        rvYear: true,
        rvMake: true,
        rvModel: true,
        rvLength: true,
        rvSleeps: true,
        rvSlideouts: true,
        rvWeight: true,
        rvWidth: true,
        rvHeight: true,
        rvMpg: true,
        rvFuelType: true,
        rvFuelGal: true,
        rvPhotoUrl: true,
        rvDescription: true,
        rvFeatures: true,
        homeCity: true,
        homeState: true,
        homeZipCode: true,
        travelPartyType: true,
        travelPartySize: true,
        hasPets: true,
        petTypes: true,
        onboardingCompleted: true,
        onboardingCompletedAt: true,
        onboardingSkippedAt: true,
        phoneNumber: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});


// Update email or phone (requires password confirmation)
router.put('/update-contact', authenticateToken, async (req: any, res) => {
  try {
    const { email, phoneNumber, currentPassword } = req.body;
    if (!currentPassword) return res.status(400).json({ error: 'Current password required' });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });

    // Check email uniqueness if changing
    if (email && email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(400).json({ error: 'Email already in use' });
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(email ? { email } : {}),
        ...(phoneNumber !== undefined ? { phoneNumber } : {}),
      },
      select: { id: true, email: true, phoneNumber: true, firstName: true, lastName: true, username: true, profilePicture: true }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact info' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req: any, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Incorrect current password' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.userId }, data: { password: hashed } });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ══ FORGOT PASSWORD ══
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal whether email exists
      return res.json({ success: true, message: 'If that email exists, we sent a reset link.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpires: expires },
    });

    const resetUrl = `https://www.rvunicorn.com/reset-password?token=${token}`;

    await sendEmail({
      to: email,
      subject: 'Reset your RVUnicorn password',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px">
          <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218289/rvunicorn/Logo_RVUnicorn.png" alt="RVUnicorn" style="width:48px;height:48px;border-radius:50%;margin-bottom:16px" />
          <h2 style="color:#1a2e4a;margin:0 0 8px">Reset Your Password</h2>
          <p style="color:#666;font-size:14px">Hey ${user.firstName}, we got your request to reset your RVUnicorn password.</p>
          <p style="color:#666;font-size:14px">Click the button below to set a new one. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#E8622A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Reset Password</a>
          <p style="color:#999;font-size:12px;margin-top:20px">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
          <p style="color:#999;font-size:12px;margin-top:16px;border-top:1px solid #eee;padding-top:16px">— The RVUnicorn Team 🦄</p>
        </div>
      `,
      text: `Reset your RVUnicorn password: ${resetUrl}`,
    });

    res.json({ success: true, message: 'If that email exists, we sent a reset link.' });
  } catch (e: any) {
    console.error('Forgot password error:', e);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// ══ RESET PASSWORD ══
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const user = await prisma.user.findFirst({
      where: { passwordResetToken: token, passwordResetExpires: { gt: new Date() } },
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, passwordResetToken: null, passwordResetExpires: null },
    });

    res.json({ success: true, message: 'Password updated! You can now sign in.' });
  } catch (e: any) {
    console.error('Reset password error:', e);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
