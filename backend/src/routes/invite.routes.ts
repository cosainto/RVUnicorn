import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth.middleware';
import { Resend } from 'resend';
import crypto from 'crypto';

const router = Router();
const resend = new Resend(process.env.RESEND_API_KEY);

const HITCH_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773890549/rvunicorn/hitch-campfire.png';
const SITE_URL = process.env.FRONTEND_URL || 'https://www.rvunicorn.com';

function buildInviteEmail(senderName: string, inviteUrl: string, personalMessage?: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>You're invited to RVUnicorn!</title></head>
<body style="margin:0;padding:0;background-color:#1a0f0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a0f0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Campfire header -->
        <tr><td align="center" style="padding-bottom:0;">
          <img src="${HITCH_IMG}" alt="Hitch at the Campfire" style="width:100%;max-width:600px;border-radius:16px 16px 0 0;display:block;" />
        </td></tr>

        <!-- Main card -->
        <tr><td style="background:linear-gradient(180deg,#2d1a0e 0%,#1f120a 100%);border-radius:0 0 16px 16px;padding:32px 40px;border:1px solid #4a2c1a;border-top:none;">

          <!-- Hitch greeting -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding-bottom:24px;">
              <div style="display:inline-block;background:rgba(255,150,50,0.15);border:1px solid rgba(255,150,50,0.3);border-radius:20px;padding:6px 16px;margin-bottom:16px;">
                <span style="color:#ff9632;font-size:13px;font-weight:600;">🦄 A message from Hitch</span>
              </div>
              <h1 style="color:#fff;font-size:28px;font-weight:700;margin:0 0 8px;line-height:1.3;">
                Hey there, fellow camper! 🔥
              </h1>
              <p style="color:#c4956a;font-size:16px;margin:0;">Pull up a chair — the fire's going!</p>
            </td></tr>

            <!-- Message -->
            <tr><td style="background:rgba(255,150,50,0.08);border:1px solid rgba(255,150,50,0.2);border-radius:12px;padding:24px;margin-bottom:24px;">
              <p style="color:#e8d5b7;font-size:16px;line-height:1.7;margin:0 0 16px;">
                Your friend <strong style="color:#ff9632;">${senderName}</strong> thinks you'd love RVUnicorn — and honestly? Hitch agrees. 🎯
              </p>
              ${personalMessage ? `<p style="color:#e8d5b7;font-size:15px;line-height:1.6;margin:0 0 16px;font-style:italic;border-left:3px solid #ff9632;padding-left:16px;">"${personalMessage}"</p>` : ''}
              <p style="color:#e8d5b7;font-size:16px;line-height:1.7;margin:0;">
                RVUnicorn is the social platform built for RV campers like you — find campgrounds that fit your rig, connect with fellow campers, plan epic trips, and play live trivia around the campfire every night at 5:30 PM. 🏕️
              </p>
            </td></tr>

            <!-- Features -->
            <tr><td style="padding:24px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48%" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:16px;vertical-align:top;">
                    <div style="font-size:24px;margin-bottom:8px;">🗺️</div>
                    <div style="color:#fff;font-size:14px;font-weight:600;margin-bottom:4px;">Find Your Next Camp</div>
                    <div style="color:#9a8070;font-size:13px;">5,000+ campgrounds matched to your rig size and style</div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:16px;vertical-align:top;">
                    <div style="font-size:24px;margin-bottom:8px;">🔥</div>
                    <div style="color:#fff;font-size:14px;font-weight:600;margin-bottom:4px;">Campfire Trivia</div>
                    <div style="color:#9a8070;font-size:13px;">Live trivia with your campsite neighbors every night at 5:30</div>
                  </td>
                </tr>
                <tr><td colspan="3" style="padding-top:12px;"></td></tr>
                <tr>
                  <td width="48%" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:16px;vertical-align:top;">
                    <div style="font-size:24px;margin-bottom:8px;">🦄</div>
                    <div style="color:#fff;font-size:14px;font-weight:600;margin-bottom:4px;">Hitch AI Guide</div>
                    <div style="color:#9a8070;font-size:13px;">Your personal RV travel companion — always on, always helpful</div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:16px;vertical-align:top;">
                    <div style="font-size:24px;margin-bottom:8px;">🏆</div>
                    <div style="color:#fff;font-size:14px;font-weight:600;margin-bottom:4px;">Badges & Rewards</div>
                    <div style="color:#9a8070;font-size:13px;">Earn badges for every adventure, check-in, and campfire win</div>
                  </td>
                </tr>
              </table>
            </td></tr>

            <!-- CTA Button -->
            <tr><td align="center" style="padding:8px 0 24px;">
              <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#ff6b2b,#ff9632);color:#fff;text-decoration:none;font-size:18px;font-weight:700;padding:16px 48px;border-radius:50px;letter-spacing:0.5px;box-shadow:0 4px 20px rgba(255,107,43,0.4);">
                🏕️ Join the Adventure
              </a>
              <p style="color:#6b5040;font-size:12px;margin:12px 0 0;">Invite expires in 7 days</p>
            </td></tr>

            <!-- Hitch sign-off -->
            <tr><td style="border-top:1px solid rgba(255,255,255,0.08);padding-top:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:12px;">
                    <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:22px;text-align:center;line-height:44px;">🦄</div>
                  </td>
                  <td>
                    <div style="color:#fff;font-size:14px;font-weight:600;">Hitch</div>
                    <div style="color:#6b5040;font-size:13px;">Your RVUnicorn Trail Guide</div>
                  </td>
                  <td style="padding-left:16px;">
                    <div style="color:#9a8070;font-size:12px;font-style:italic;">"See you around the campfire! 🔥"</div>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding-top:24px;">
          <p style="color:#4a3020;font-size:12px;margin:0;">
            © 2025 RVUnicorn · <a href="${SITE_URL}" style="color:#6b5040;text-decoration:none;">rvunicorn.com</a>
          </p>
          <p style="color:#3a2010;font-size:11px;margin:8px 0 0;">You received this because a friend thought you'd love it. No account needed to unsubscribe.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// POST /api/invites/send
router.post('/send', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { email, personalMessage } = req.body;

    if (!email?.trim()) return res.status(400).json({ error: 'Email required' });

    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, username: true },
    });
    if (!sender) return res.status(404).json({ error: 'User not found' });

    // Check if already invited
    const existing = await prisma.invite.findFirst({
      where: { senderId: userId, email: email.toLowerCase(), status: 'pending' },
    });
    if (existing) return res.status(400).json({ error: 'Already invited this email' });

    // Create invite
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.invite.create({
      data: {
        senderId: userId,
        email: email.toLowerCase(),
        token,
        expiresAt,
      },
    });

    const inviteUrl = `${SITE_URL}/join?token=${token}&ref=${sender.username}`;
    const html = buildInviteEmail(sender.firstName || sender.username, inviteUrl, personalMessage);

    await resend.emails.send({
      from: 'Hitch at RVUnicorn <hitch@updates.rvunicorn.com>',
      to: email,
      subject: `${sender.firstName || 'A friend'} invited you to join RVUnicorn 🔥`,
      html,
    });

    res.json({ success: true, message: 'Invite sent!' });
  } catch (e: any) {
    console.error('Invite error:', e?.message);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

// GET /api/invites/accept?token=xxx
router.get('/accept', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.redirect(`${SITE_URL}/signup`);

    const invite = await prisma.invite.findUnique({ where: { token: String(token) } });
    if (!invite || invite.status !== 'pending' || new Date() > invite.expiresAt) {
      return res.redirect(`${SITE_URL}/signup`);
    }

    // Mark as accepted
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    });

    // Award Trail Blazer badge to sender
    try {
      const { awardBadge } = await import('../services/badge.service');
      await awardBadge(invite.senderId, 'trail-blazer');
    } catch {}

    res.redirect(`${SITE_URL}/signup?ref=${token}&invited=true`);
  } catch (e: any) {
    res.redirect(`${SITE_URL}/signup`);
  }
});

// GET /api/invites/my — get user's sent invites
router.get('/my', authenticateToken, async (req: any, res) => {
  try {
    const invites = await prisma.invite.findMany({
      where: { senderId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ invites });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
