import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import Stripe from 'stripe';

const router = Router();
const prisma = new PrismaClient();
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' as any })
  : null;
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://www.rvunicorn.com').replace(/"/g, '');

const TIER_LEVELS: Record<string, number> = { TRAILHEAD: 0, BASECAMP: 1, SUMMIT: 2, FOUNDING: 2 };

if (!stripe) console.warn('[Stripe] STRIPE_SECRET_KEY not set — Stripe routes will return errors');

// ── Server-side price catalog ─────────────────────────────────────────────
// IMPORTANT: never trust the priceId from the client. Anyone could POST a
// $0.01 price and check out at that price. Resolve from env vars on the server,
// keyed only by validated tier. Each tier has exactly one billing cycle:
//   BASECAMP → monthly
//   SUMMIT   → monthly
//   FOUNDING → yearly (locked-in lifetime, capped at 50 spots)
// Stripe API version 2026-03-25.dahlia restructured invoice payloads —
// `subscription_details` (and `subscription`) moved from the top level into
// a `parent` field. Read from both paths so the handler is robust across
// API versions, since our SDK is pinned to acacia but webhooks may arrive
// in dahlia format depending on which version was active when the webhook
// destination was created.
function invoiceCampgroundId(invoice: any): string | undefined {
  return (
    invoice?.parent?.subscription_details?.metadata?.campgroundId ||
    invoice?.subscription_details?.metadata?.campgroundId ||
    invoice?.lines?.data?.[0]?.metadata?.campgroundId ||
    undefined
  );
}

// Map our Stripe-side tier names to the legacy CampgroundTier enum on the
// Campground model. The enum predates the Stripe integration and only knows
// about FREE / CLASS_C / CLASS_B / CLASS_A. Without this mapping, every
// `prisma.campground.update({ tier: 'BASECAMP' })` silently fails (the .catch
// in the webhook swallowed it for weeks).
//
// Mapping rationale: the upgrade page advertises Base Camp as including
// stickers / analytics / branding, which the legacy SIDEBAR_ITEMS gate behind
// CLASS_B and CLASS_A. So all paid Stripe tiers must map to CLASS_A (the
// highest legacy enum) to actually unlock the features customers paid for.
// Differentiation between Base Camp / Summit / Founding happens via the
// stripeSub.tier string, which is accurate.
function tierToLegacyEnum(tier: string | undefined): 'FREE' | 'CLASS_C' | 'CLASS_B' | 'CLASS_A' {
  switch (tier) {
    case 'BASECAMP':
    case 'SUMMIT':
    case 'FOUNDING':
      return 'CLASS_A';
    default:
      return 'FREE';
  }
}

type Tier = 'BASECAMP' | 'SUMMIT' | 'FOUNDING';
function resolvePriceId(tier: Tier): string | null {
  const map: Record<Tier, string | undefined> = {
    BASECAMP: process.env.STRIPE_BASECAMP_PRICE_ID,
    SUMMIT:   process.env.STRIPE_SUMMIT_PRICE_ID,
    FOUNDING: process.env.STRIPE_FOUNDING_PRICE_ID,
  };
  return map[tier] || null;
}

// ══ POST /api/stripe/create-checkout ══
router.post('/create-checkout', authenticateToken, async (req: any, res: Response) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  try {
    const { campgroundId, tier } = req.body as { campgroundId?: string; tier?: string };

    // Validate inputs server-side — never trust shapes from the client.
    if (!campgroundId) return res.status(400).json({ error: 'campgroundId required' });
    if (tier !== 'BASECAMP' && tier !== 'SUMMIT' && tier !== 'FOUNDING') {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const priceId = resolvePriceId(tier as Tier);
    if (!priceId) {
      console.error(`[Stripe] Missing env var for ${tier} — set STRIPE_${tier}_PRICE_ID on Railway`);
      return res.status(503).json({ error: 'This plan is not available yet — pricing not configured' });
    }

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
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
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
// Pause-for-the-season flow. Always sets a resumes_at so Stripe auto-resumes
// the subscription if the owner forgets to come back. Capped at 6 months — if
// no resumeDate is passed, defaults to now + 6 months. If a date longer than
// 6 months is passed, it's silently capped.
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
router.post('/pause', authenticateToken, async (req: any, res: Response) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  try {
    const { campgroundId, resumeDate } = req.body as { campgroundId?: string; resumeDate?: string };
    if (!campgroundId) return res.status(400).json({ error: 'campgroundId required' });

    // Verify the caller actually owns this campground.
    const campground = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { claimedById: true } });
    if (!campground || campground.claimedById !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const sub = await (prisma as any).campgroundSubscription.findUnique({ where: { campgroundId } });
    if (!sub?.stripeSubscriptionId) return res.status(400).json({ error: 'No active subscription' });
    if (sub.status === 'PAUSED') return res.status(400).json({ error: 'Subscription is already paused' });

    const now = Date.now();
    const sixMonthsFromNow = now + SIX_MONTHS_MS;
    let resumesAtMs: number;
    if (resumeDate) {
      const requested = new Date(resumeDate).getTime();
      if (isNaN(requested) || requested <= now) return res.status(400).json({ error: 'Invalid resumeDate' });
      resumesAtMs = Math.min(requested, sixMonthsFromNow);
    } else {
      resumesAtMs = sixMonthsFromNow;
    }

    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      pause_collection: {
        behavior: 'mark_uncollectible',
        resumes_at: Math.floor(resumesAtMs / 1000),
      },
    });

    await (prisma as any).campgroundSubscription.update({
      where: { campgroundId },
      data: { status: 'PAUSED', pausedAt: new Date(now), pauseResumesAt: new Date(resumesAtMs) },
    });

    res.json({ success: true, resumesAt: new Date(resumesAtMs).toISOString() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ POST /api/stripe/resume ══
// Resume a paused subscription immediately.
router.post('/resume', authenticateToken, async (req: any, res: Response) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  try {
    const { campgroundId } = req.body as { campgroundId?: string };
    if (!campgroundId) return res.status(400).json({ error: 'campgroundId required' });

    const campground = await prisma.campground.findUnique({ where: { id: campgroundId }, select: { claimedById: true } });
    if (!campground || campground.claimedById !== req.userId) return res.status(403).json({ error: 'Not authorized' });

    const sub = await (prisma as any).campgroundSubscription.findUnique({ where: { campgroundId } });
    if (!sub?.stripeSubscriptionId) return res.status(400).json({ error: 'No subscription found' });

    // Clearing pause_collection resumes the subscription immediately.
    await stripe.subscriptions.update(sub.stripeSubscriptionId, { pause_collection: '' as any });

    await (prisma as any).campgroundSubscription.update({
      where: { campgroundId },
      data: { status: 'ACTIVE', pausedAt: null, pauseResumesAt: null },
    });

    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ══ POST /api/stripe/webhook ══
router.post('/webhook', async (req: Request, res: Response) => {
  if (!stripe) return res.status(503).send('Stripe not configured');
  const sig = req.headers['stripe-signature'];
  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).send('Missing signature');

  // The global express.json() verify hook stashes the raw bytes on req.rawBody
  // (see backend/src/index.ts). Stripe needs those bytes — not the parsed
  // object — to verify the signature.
  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    console.error('[Stripe Webhook] req.rawBody missing — express.json verify hook is not running');
    return res.status(500).send('Webhook misconfigured');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(400).send('Invalid signature');
  }

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

        try {
          await prisma.campground.update({
            where: { id: campgroundId },
            data: { tier: tierToLegacyEnum(tier) as any },
          });
        } catch (e: any) {
          console.error(`[Stripe] Failed to update campground.tier for ${campgroundId}:`, e.message);
        }
        console.log(`[Stripe] ✓ ${campgroundId} upgraded to ${tier} (legacy enum: ${tierToLegacyEnum(tier)})`);
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
        try {
          await prisma.campground.update({ where: { id: campgroundId }, data: { tier: 'FREE' as any } });
        } catch (e: any) {
          console.error(`[Stripe] Failed to reset campground.tier for ${campgroundId}:`, e.message);
        }
        console.log(`[Stripe] ✗ ${campgroundId} cancelled → TRAILHEAD`);
        break;
      }

      // customer.subscription.updated handles three transitions Stripe doesn't
      // give dedicated event types for:
      //   • pause_collection set      → status PAUSED
      //   • pause_collection cleared   → status ACTIVE
      //   • cancel_at_period_end true  → status CANCELLING (still active until period end)
      //   • cancel_at_period_end false → status ACTIVE (customer reactivated)
      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        const campgroundId = sub.metadata?.campgroundId;
        if (!campgroundId) break;
        const dbSub = await (prisma as any).campgroundSubscription.findUnique({ where: { campgroundId } });
        if (!dbSub) break;

        const isPaused = !!sub.pause_collection;
        const isCancelling = !!sub.cancel_at_period_end;
        // Stripe ships current_period_end as a top-level field on subscriptions
        // in older API versions and nested under items.data[0] in newer ones.
        const periodEndUnix =
          sub.current_period_end ||
          sub.items?.data?.[0]?.current_period_end ||
          sub.cancel_at ||
          null;
        const periodEndDate = periodEndUnix ? new Date(periodEndUnix * 1000) : null;

        // Pause transitions
        if (isPaused && dbSub.status !== 'PAUSED') {
          await (prisma as any).campgroundSubscription.update({
            where: { campgroundId },
            data: {
              status: 'PAUSED',
              pausedAt: new Date(),
              pauseResumesAt: sub.pause_collection.resumes_at
                ? new Date(sub.pause_collection.resumes_at * 1000)
                : null,
            },
          });
          console.log(`[Stripe] ⏸ ${campgroundId} paused`);
          break;
        }
        if (!isPaused && dbSub.status === 'PAUSED') {
          await (prisma as any).campgroundSubscription.update({
            where: { campgroundId },
            data: { status: 'ACTIVE', pausedAt: null, pauseResumesAt: null },
          });
          console.log(`[Stripe] ▶ ${campgroundId} resumed`);
          break;
        }

        // Cancel-at-period-end transitions
        if (isCancelling && dbSub.status !== 'CANCELLING') {
          await (prisma as any).campgroundSubscription.update({
            where: { campgroundId },
            data: {
              status: 'CANCELLING',
              currentPeriodEnd: periodEndDate,
            },
          });
          console.log(`[Stripe] ⌛ ${campgroundId} cancellation pending until ${periodEndDate?.toISOString()}`);
          break;
        }
        if (!isCancelling && dbSub.status === 'CANCELLING') {
          await (prisma as any).campgroundSubscription.update({
            where: { campgroundId },
            data: { status: 'ACTIVE' },
          });
          console.log(`[Stripe] ↺ ${campgroundId} cancellation reversed`);
          break;
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const campgroundId = invoiceCampgroundId(invoice);
        if (!campgroundId) { console.warn('[Stripe] invoice.payment_failed has no campgroundId metadata'); break; }
        await (prisma as any).campgroundSubscription.update({ where: { campgroundId }, data: { status: 'PAST_DUE' } });
        console.log(`[Stripe] ⚠ ${campgroundId} payment failed`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const campgroundId = invoiceCampgroundId(invoice);
        if (!campgroundId) { console.warn('[Stripe] invoice.payment_succeeded has no campgroundId metadata'); break; }
        await (prisma as any).campgroundSubscription.update({
          where: { campgroundId },
          data: { status: 'ACTIVE', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000) },
        }).catch(() => {});
        console.log(`[Stripe] ✓ ${campgroundId} invoice paid`);
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
