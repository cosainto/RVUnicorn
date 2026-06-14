import { prisma } from '../lib/prisma';
const db = prisma as any;
import { Resend } from 'resend';
import { canSendEmail, queueForDigest } from '../services/emailThrottle';

const SITE = 'https://www.rvunicorn.com';
const HITCH_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218289/rvunicorn/guides/hitch_guide.png';

function emailWrap(body: string): string {
  return `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="background:linear-gradient(135deg,#f59e0b,#ea580c);padding:20px;text-align:center;border-radius:12px 12px 0 0;">
      <h1 style="color:white;margin:0;font-size:22px;">🦄 RVUnicorn</h1>
    </div>
    <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-top:0;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <img src="${HITCH_IMG}" width="40" height="40" style="border-radius:50%;object-fit:cover;" />
        <strong style="color:#1a1a1a;">Hitch</strong>
      </div>
      ${body}
    </div>
    <div style="text-align:center;padding:16px;color:#9ca3af;font-size:11px;">
      © RVUnicorn · <a href="${SITE}/settings" style="color:#9ca3af;">Unsubscribe</a>
    </div>
  </div>`;
}

function ctaButton(text: string, url: string): string {
  return `<div style="text-align:center;margin:24px 0;"><a href="${url}" style="display:inline-block;background:#f59e0b;color:white;font-weight:700;padding:12px 24px;border-radius:12px;text-decoration:none;font-size:15px;">${text}</a></div>`;
}

interface DripConfig {
  emailType: string;
  delayHours: number;
  buildEmail: (user: any) => Promise<{ subject: string; html: string } | null>;
}

const DRIPS: DripConfig[] = [
  {
    emailType: 'welcome',
    delayHours: 0.5,
    buildEmail: async (user) => ({
      subject: `🔥 Welcome to the campfire, ${user.firstName || 'friend'}!`,
      html: emailWrap(`
        <p style="font-size:15px;color:#1a1a1a;">Hey ${user.firstName || 'friend'} — your rig is on the grid and I've already got some ideas for your next trip.</p>
        <p style="font-size:14px;color:#4b5563;">Tap any campground to start planning. Whether you're a weekend warrior or a full-timer, RVUnicorn has your back. 🏕️</p>
        ${ctaButton('Explore my picks →', `${SITE}/basecamp`)}
        <p style="font-size:13px;color:#6b7280;">See you around the campfire!</p>
      `),
    }),
  },
  {
    emailType: 'community',
    delayHours: 48,
    buildEmail: async (user) => {
      const posts = await db.boardPost.findMany({
        orderBy: { voteScore: 'desc' },
        take: 3,
        include: { board: { select: { name: true, slug: true } } },
      });
      if (posts.length === 0) return null;
      const boardName = posts[0].board?.name || 'the community';
      const slug = posts[0].board?.slug || '';
      const postCards = posts.map((p: any) => `<div style="padding:10px 0;border-bottom:1px solid #f3f4f6;"><strong style="color:#1a1a1a;font-size:14px;">${p.title}</strong><br/><span style="color:#9ca3af;font-size:12px;">🔥 ${p.voteScore} votes</span></div>`).join('');
      return {
        subject: `💬 3 conversations happening right now in ${boardName}`,
        html: emailWrap(`
          <p style="font-size:15px;color:#1a1a1a;">Hey ${user.firstName || 'friend'} — thought you'd want to see what's buzzing in ${boardName} today.</p>
          ${postCards}
          ${ctaButton('Join the conversation →', `${SITE}/community/${slug}`)}
        `),
      };
    },
  },
  {
    emailType: 'social',
    delayHours: 72,
    buildEmail: async (user) => {
      const state = user.homeState;
      if (!state) return null;
      const nearby = await db.user.findMany({
        where: { homeState: state, id: { not: user.id } },
        select: { firstName: true, rvMake: true, homeCity: true, profilePicture: true },
        take: 3,
      });
      if (nearby.length === 0) return null;
      const cards = nearby.map((u: any) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6;">${u.profilePicture ? `<img src="${u.profilePicture}" width="36" height="36" style="border-radius:50%;object-fit:cover;" />` : '<div style="width:36px;height:36px;border-radius:50%;background:#fed7aa;display:flex;align-items:center;justify-content:center;font-weight:700;color:#c2410c;">' + (u.firstName?.[0] || '?') + '</div>'}<div><strong style="color:#1a1a1a;font-size:13px;">${u.firstName}</strong><br/><span style="color:#9ca3af;font-size:11px;">${u.rvMake || ''} · ${u.homeCity || state}</span></div></div>`).join('');
      return {
        subject: `👋 ${nearby.length} RVers near ${state} want to connect`,
        html: emailWrap(`
          <p style="font-size:15px;color:#1a1a1a;">Hey ${user.firstName || 'friend'} — found some campers near ${state} who'd love to meet you.</p>
          ${cards}
          ${ctaButton("See who's nearby →", `${SITE}/community`)}
        `),
      };
    },
  },
  {
    emailType: 'trivia',
    delayHours: 120,
    buildEmail: async (user) => ({
      subject: `🎯 Campfire Trivia tonight at 5:30 PM — can you go 10/10?`,
      html: emailWrap(`
        <p style="font-size:15px;color:#1a1a1a;">Quick heads up — trivia starts tonight at 5:30 PM CT! 🔥</p>
        <p style="font-size:14px;color:#4b5563;">Last week's champ scored 480 points. Think you can beat that? 10 questions, 2 minutes each, speed bonus points for fast answers.</p>
        ${ctaButton("I'm in →", `${SITE}/basecamp`)}
        <p style="font-size:13px;color:#6b7280;">See you at the campfire, ${user.firstName || 'friend'}!</p>
      `),
    }),
  },
  {
    emailType: 'first_trip',
    delayHours: 168,
    buildEmail: async (user) => {
      const hasTrip = await db.event.count({ where: { organizerId: user.id } });
      if (hasTrip > 0) return null;
      const state = user.homeState || 'your area';
      return {
        subject: `🗺️ You haven't planned a trip yet — here's 3 campgrounds near ${state}`,
        html: emailWrap(`
          <p style="font-size:15px;color:#1a1a1a;">Hey ${user.firstName || 'friend'} — noticed you haven't planned a trip yet. No pressure!</p>
          <p style="font-size:14px;color:#4b5563;">I found some great spots near ${state} that fit your style. Want me to map a route? It takes 30 seconds.</p>
          ${ctaButton('Plan my first trip →', `${SITE}/trips`)}
        `),
      };
    },
  },
];

export async function runEmailDripCron() {
  const resend = new Resend(process.env.RESEND_API_KEY);

  for (const drip of DRIPS) {
    try {
      const cutoffTime = new Date(Date.now() - drip.delayHours * 60 * 60 * 1000);
      const maxAge = new Date(Date.now() - (drip.delayHours + 24) * 60 * 60 * 1000);

      // Find users who signed up within the drip window and haven't received this email
      const users = await db.user.findMany({
        where: {
          createdAt: { gte: maxAge, lte: cutoffTime },
          email: { not: null as any },
          emailDripLogs: { none: { emailType: drip.emailType } },
        },
        select: {
          id: true, email: true, firstName: true, homeState: true, homeCity: true,
          rvMake: true, rvModel: true, rvType: true, userPersona: true, profilePicture: true,
        },
        take: 50,
      });

      for (const user of users) {
        if (!user.email) continue;
        try {
          const email = await drip.buildEmail(user);
          if (!email) continue;

          // Map drip emailType to throttle type
          const throttleType = `DRIP_${drip.emailType.toUpperCase()}`;
          const throttle = await canSendEmail(user.id, throttleType);

          if (throttle.canSend) {
            await resend.emails.send({
              from: 'Hitch from RVUnicorn <hitch@updates.rvunicorn.com>',
              to: user.email,
              subject: email.subject,
              html: email.html,
            });

            await db.emailLog.create({
              data: { userId: user.id, type: throttleType, priority: throttle.priority, subject: email.subject },
            });
          } else if (throttle.queueForDigest && throttle.digestType) {
            await queueForDigest(user.id, throttle.digestType, throttleType, {
              subject: email.subject,
              previewText: email.subject,
            });
          }

          // Always mark drip as sent so we don't retry
          await db.emailDripLog.create({
            data: { userId: user.id, emailType: drip.emailType },
          });
        } catch {}
      }
    } catch {}
  }
}
