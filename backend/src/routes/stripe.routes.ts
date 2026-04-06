import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import Stripe from 'stripe';

const router = Router();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-12-18.acacia' as any });
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://www.rvunicorn.com').replace(/"/g, '');

const TIER_LEVELS: Record<string, number> = { TRAILHEAD: 0, BASECAMP: 1, SUMMIT: 2, FOUNDING: 2 };

// ══ POST /api/stripe/create-checkout ══
router.post('/create-checkout', authenticateToken, async (req: any, res: Response) => {
  try {
    const { campgroundId, priceId, tier } = req.body;
    const campground = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { name: true, claimedById: true } });
    if (!campground || campground.claimedById !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    // Check founding limit
    if (tier === 'FOUNDING') {
      const foundingCount = await (prisma as any).campgroundSubscription.count({ where: { isFoundingMember: true } });
      if (foundingCount >= 50) return res.status(400).json({ error: 'All 50 Founding Partner spots have been claimed!' });
    }

    // Get or create Stripe customer
    let sub = await (prisma as any).campgroundSubscription.findUnique({ where: { campgroundId } });
    let customerId = sub?.stripeCustomerId;
    if (!customerId) {
      const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true, firstName: true, lastName: true } });
      const customer = await stripe.customers.create({ email: user?.email, name: `${user?.firstName} ${user?.lastName}`, metadata: { campgroundId, userId: req.userId } });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${FRONTEND_URL}/business/${campgroundId}?upgraded=true`,
      cancel_url: `${FRONTEND_URL}/business/${campgroundId}?upgrade=cancelled`,
      metadata: { campgroundId, userId: req.userId, tier },
      subscription_data: {
        trial_period_days: tier === 'BASECAMP' ? 30 : undefined,
        metadata: { campgroundId, tier },
      },
    });

    res.json({ url: session.url });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ POST /api/stripe/create-portal ══
router.post('/create-portal', authenticateToken, async (req: any, res: Response) => {
  try {
    const { campgroundId } = req.body;
    const sub = await (prisma as any).campgroundSubscription.findUnique({ where: { campgroundId } });
    if (!sub?.stripeCustomerId) return res.status(400).json({ error: 'No billing account found' });

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${FRONTEND_URL}/business/${campgroundId}`,
    });
    res.json({ url: session.url });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ POST /api/stripe/pause ══
router.post('/pause', authenticateToken, async (req: any, res: Response) => {
  try {
    const { campgroundId, resumeDate } = req.body;
    const sub = await (prisma as any).campgroundSubscription.findUnique({ where: { campgroundId } });
    if (!sub?.stripeSubscriptionId) return res.status(400).json({ error: 'No active subscription' });

    // Pause collection on Stripe
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      pause_collection: { behavior: 'mark_uncollectable', resumes_at: resumeDate ? Math.floor(new Date(resumeDate).getTime() / 1000) : undefined },
    });

    await (prisma as any).campgroundSubscription.update({
      where: { campgroundId },
      data: { status: 'PAUSED', pausedAt: new Date(), pauseResumesAt: resumeDate ? new Date(resumeDate) : null },
    });

    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ POST /api/stripe/webhook ══
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).send('Missing signature');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch { return res.status(400).send('Invalid signature'); }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const { campgroundId, tier, userId } = session.metadata || {};
        if (!campgroundId) break;

        await (prisma as any).campgroundSubscription.upsert({
          where: { campgroundId },
          create: {
            campgroundId, tier: tier || 'BASECAMP', status: 'ACTIVE',
            stripeCustomerId: session.customer, stripeSubscriptionId: session.subscription,
            isFoundingMember: tier === 'FOUNDING', foundingMemberSince: tier === 'FOUNDING' ? new Date() : null,
            trialStartDate: tier === 'BASECAMP' ? new Date() : null,
            trialEndDate: tier === 'BASECAMP' ? new Date(Date.now() + 30 * 86400000) : null,
          },
          update: {
            tier: tier || 'BASECAMP', status: 'ACTIVE',
            stripeCustomerId: session.customer, stripeSubscriptionId: session.subscription,
            isFoundingMember: tier === 'FOUNDING',
          },
        });

        await prisma.campground.update({ where: { id: campgroundId }, data: { tier: tier || 'BASECAMP' } }).catch(() => {});
        console.log(`[Stripe] ✓ ${campgroundId} upgraded to ${tier}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        const campgroundId = sub.metadata?.campgroundId;
        if (!campgroundId) break;
        await (prisma as any).campgroundSubscription.update({
          where: { campgroundId },
          data: { status: 'CANCELLED', tier: 'TRAILHEAD', cancelledAt: new Date() },
        });
        await prisma.campground.update({ where: { id: campgroundId }, data: { tier: 'FREE' } }).catch(() => {});
        console.log(`[Stripe] ✗ ${campgroundId} cancelled → TRAILHEAD`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const campgroundId = invoice.subscription_details?.metadata?.campgroundId;
        if (!campgroundId) break;
        await (prisma as any).campgroundSubscription.update({ where: { campgroundId }, data: { status: 'PAST_DUE' } });
        console.log(`[Stripe] ⚠ ${campgroundId} payment failed`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const campgroundId = invoice.subscription_details?.metadata?.campgroundId;
        if (!campgroundId) break;
        await (prisma as any).campgroundSubscription.update({
          where: { campgroundId },
          data: { status: 'ACTIVE', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000) },
        }).catch(() => {});
        break;
      }
    }
  } catch (e) { console.error('[Stripe Webhook] Error:', e); }

  res.json({ received: true });
});

// ══ GET /api/stripe/subscription/:campgroundId ══
router.get('/subscription/:campgroundId', authenticateToken, async (req: any, res: Response) => {
  try {
    const sub = await (prisma as any).campgroundSubscription.findUnique({ where: { campgroundId: req.params.campgroundId } });
    res.json({ subscription: sub || { tier: 'TRAILHEAD', status: 'ACTIVE' } });
  } catch { res.json({ subscription: { tier: 'TRAILHEAD', status: 'ACTIVE' } }); }
});

// ══ GET /api/stripe/founding-count ══
router.get('/founding-count', async (_req, res: Response) => {
  try {
    const count = await (prisma as any).campgroundSubscription.count({ where: { isFoundingMember: true } });
    res.json({ count, remaining: Math.max(0, 50 - count), isFull: count >= 50 });
  } catch { res.json({ count: 0, remaining: 50, isFull: false }); }
});

export default router;
