import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const rawFrontendUrl = process.env.FRONTEND_URL || 'https://www.rvunicorn.com';
const FRONTEND_URL = rawFrontendUrl.replace(/"/g, '').replace(/\/$/, '').replace('http://localhost:5173', 'https://www.rvunicorn.com');
console.log('[OAuth] FRONTEND_URL:', FRONTEND_URL);

// ══ Find or Create OAuth User ══
async function findOrCreateOAuthUser(provider: string, profile: any): Promise<{ user: any; isNew: boolean }> {
  const providerId = profile.id;
  const email = profile.emails?.[0]?.value || `${provider}-${providerId}@oauth.rvunicorn.com`;
  const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || 'RVer';
  const lastName = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '';
  const profilePicture = profile.photos?.[0]?.value || null;

  // Check if OAuth account already exists
  const existingOAuth = await prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider, providerId } },
    include: { user: true },
  });

  if (existingOAuth) {
    return { user: existingOAuth.user, isNew: false };
  }

  // Check if email already exists as a regular account
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    // Link OAuth to existing account
    await prisma.oAuthAccount.create({
      data: { userId: existingUser.id, provider, providerId },
    });
    return { user: existingUser, isNew: false };
  }

  // Create new user + OAuth account
  const username = `${firstName.toLowerCase()}${Math.random().toString(36).slice(2, 6)}`;
  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      username,
      password: `OAUTH_${provider.toUpperCase()}_${Date.now()}`, // No password login for OAuth users
      profilePicture,
      ...(provider === 'facebook' && profile.profileUrl ? { facebookUrl: profile.profileUrl } : {}),
    },
  });

  await prisma.oAuthAccount.create({
    data: { userId: user.id, provider, providerId },
  });

  // Award badges
  try {
    await prisma.badge.findFirst({ where: { slug: 'rvunicorn-member' } }).then(async (badge) => {
      if (badge) await prisma.userBadge.create({ data: { userId: user.id, badgeId: badge.id } }).catch(() => {});
    });
    // Founding Member — limited to first 5,000
    const foundingBadge = await prisma.badge.findFirst({ where: { slug: 'founding-member' } });
    if (foundingBadge) {
      const issued = await prisma.userBadge.count({ where: { badgeId: foundingBadge.id } });
      if (issued < 5000) {
        await prisma.userBadge.create({ data: { userId: user.id, badgeId: foundingBadge.id, badgeNumber: issued + 1 } }).catch(() => {});
      }
    }
  } catch {}

  return { user, isNew: true };
}

function generateToken(user: any): string {
  return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}

// ══ GOOGLE ══
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${FRONTEND_URL}/api/auth/google/callback`,
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const result = await findOrCreateOAuthUser('google', profile);
      done(null, result);
    } catch (err) { done(err as Error); }
  }));

  router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

  router.get('/auth/google/callback', passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=google` }),
    (req: Request, res: Response) => {
      const { user, isNew } = req.user as any;
      const token = generateToken(user);
      res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&isNew=${isNew}`);
    }
  );
}

// ══ FACEBOOK ══
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: `${FRONTEND_URL}/api/auth/facebook/callback`,
    profileFields: ['id', 'emails', 'name', 'displayName', 'photos', 'profileUrl'],
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const result = await findOrCreateOAuthUser('facebook', profile);
      done(null, result);
    } catch (err) { done(err as Error); }
  }));

  router.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'public_profile'], session: false }));

  router.get('/auth/facebook/callback', passport.authenticate('facebook', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=facebook` }),
    (req: Request, res: Response) => {
      const { user, isNew } = req.user as any;
      const token = generateToken(user);
      res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&isNew=${isNew}`);
    }
  );
}

// ══ APPLE (POST-based) ══
router.post('/auth/apple/callback', async (req: Request, res: Response) => {
  try {
    const { id_token, user: appleUser } = req.body;
    if (!id_token) return res.redirect(`${FRONTEND_URL}/login?error=apple`);

    // Decode Apple JWT (id_token) to get sub and email
    const decoded = jwt.decode(id_token) as any;
    if (!decoded?.sub) return res.redirect(`${FRONTEND_URL}/login?error=apple`);

    const profile: any = {
      id: decoded.sub,
      emails: decoded.email ? [{ value: decoded.email }] : [],
      name: {},
      displayName: '',
    };

    // Apple only sends user name on first login
    if (appleUser) {
      try {
        const userData = typeof appleUser === 'string' ? JSON.parse(appleUser) : appleUser;
        profile.name = { givenName: userData.name?.firstName, familyName: userData.name?.lastName };
        profile.displayName = `${userData.name?.firstName || ''} ${userData.name?.lastName || ''}`.trim();
      } catch {}
    }

    const result = await findOrCreateOAuthUser('apple', profile);
    const token = generateToken(result.user);
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&isNew=${result.isNew}`);
  } catch {
    res.redirect(`${FRONTEND_URL}/login?error=apple`);
  }
});

// ══ CONNECTED ACCOUNTS ══
router.get('/auth/oauth/connected', authenticateToken, async (req: any, res: Response) => {
  try {
    const accounts = await prisma.oAuthAccount.findMany({
      where: { userId: req.userId },
      select: { provider: true, createdAt: true },
    });
    res.json({ accounts });
  } catch { res.json({ accounts: [] }); }
});

// ══ DISCONNECT PROVIDER ══
router.delete('/auth/oauth/disconnect/:provider', authenticateToken, async (req: any, res: Response) => {
  try {
    const { provider } = req.params;
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { password: true } });
    const oauthCount = await prisma.oAuthAccount.count({ where: { userId: req.userId } });

    // Prevent disconnecting last login method
    const hasPassword = user?.password && !user.password.startsWith('OAUTH_');
    if (!hasPassword && oauthCount <= 1) {
      return res.status(400).json({ error: 'Cannot disconnect your only login method. Set a password first.' });
    }

    await prisma.oAuthAccount.deleteMany({ where: { userId: req.userId, provider } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// Initialize passport (no sessions)
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user: any, done) => done(null, user));

export default router;
