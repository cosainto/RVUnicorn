import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';

const router = Router();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/quiz/recommendations
router.post('/recommendations', async (req: Request, res: Response) => {
  try {
    const { rvType, travelStyle, vibe, priorities = [], states = [], email, firstName } = req.body;

    // Build campground filter
    const where: any = {};
    if (states.length > 0) where.state = { in: states };

    const amenityFilters: any[] = [];
    if (travelStyle === 'full-hookups') amenityFilters.push({ hasFullHookups: true });
    if (vibe === 'family') amenityFilters.push({ OR: [{ hasPool: true }, { amenities: { hasSome: ['playground'] } }] });
    if (vibe === 'pet') amenityFilters.push({ hasPets: true });

    for (const p of priorities) {
      if (p === 'pool') amenityFilters.push({ hasPool: true });
      if (p === 'store') amenityFilters.push({ hasStore: true });
      if (p === 'showers') amenityFilters.push({ hasShowers: true });
      if (p === 'pet') amenityFilters.push({ hasPets: true });
      if (p === 'bigrig') amenityFilters.push({ hasPullThrough: true });
    }

    if (amenityFilters.length > 0) where.AND = amenityFilters;

    const candidates = await prisma.campground.findMany({
      where,
      select: {
        id: true, name: true, state: true, city: true, description: true,
        imageUrl: true, latitude: true, longitude: true,
        hasPool: true, hasFullHookups: true, hasElectricHookup: true,
        hasWaterHookup: true, hasSewerHookup: true, hasPullThrough: true,
        hasStore: true, hasShowers: true, hasWifi: true, hasPets: true,
        hasRestrooms: true, hasDumpStation: true, cellService: true,
        amenities: true,
      },
      take: 50,
      orderBy: { updatedAt: 'desc' },
    });

    if (candidates.length === 0) {
      // Fallback: get any campgrounds from requested states without amenity filter
      const fallback = await prisma.campground.findMany({
        where: states.length > 0 ? { state: { in: states } } : {},
        select: {
          id: true, name: true, state: true, city: true, description: true,
          imageUrl: true, hasPool: true, hasFullHookups: true, hasPullThrough: true,
          hasStore: true, hasShowers: true, hasWifi: true, hasPets: true, amenities: true,
        },
        take: 50,
        orderBy: { updatedAt: 'desc' },
      });
      candidates.push(...fallback);
    }

    // Ask Claude to rank and pick the best 8
    const campSummaries = candidates.slice(0, 50).map(c => ({
      id: c.id, name: c.name, state: c.state, city: c.city,
      amenities: [
        c.hasPool && 'pool', c.hasFullHookups && 'full hookups',
        c.hasPullThrough && 'pull-through', c.hasStore && 'store',
        c.hasShowers && 'showers', c.hasWifi && 'WiFi',
        c.hasPets && 'pet-friendly',
      ].filter(Boolean).join(', '),
      description: c.description?.slice(0, 100) || '',
    }));

    const prompt = `You are Hitch, the friendly RVUnicorn campground recommendation AI.

A camper just told us:
- RV type: ${rvType || 'not specified'}
- Travel style: ${travelStyle || 'not specified'}
- Vibe: ${vibe || 'not specified'}
- Priorities: ${priorities.join(', ') || 'none'}
- States they want to explore: ${states.join(', ') || 'anywhere'}

Here are ${campSummaries.length} candidate campgrounds:
${JSON.stringify(campSummaries)}

Pick the best 8 campgrounds for this camper. Return ONLY a JSON array, no markdown:
[{"id":"...","reason":"One personalized sentence explaining why this campground is perfect for them"}]

Be specific in the reasons — reference their RV type, vibe, or priorities. Be warm and encouraging.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    const clean = text.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\[[\s\S]*\]/);
    const picks: { id: string; reason: string }[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    // Build full results
    const recommendations = picks.slice(0, 8).map(pick => {
      const cg = candidates.find(c => c.id === pick.id);
      if (!cg) return null;
      return { ...cg, reason: pick.reason };
    }).filter(Boolean);

    // If AI returned fewer than 8, pad with candidates
    if (recommendations.length < 8) {
      for (const c of candidates) {
        if (recommendations.length >= 8) break;
        if (!recommendations.find((r: any) => r.id === c.id)) {
          recommendations.push({ ...c, reason: 'A great campground that matches your style!' });
        }
      }
    }

    // Store lead
    await prisma.quizLead.create({
      data: { email: email || null, firstName: firstName || null, rvType, travelStyle, vibe, priorities, states },
    });

    res.json({ recommendations });
  } catch (e) {
    console.error('Quiz recommendation error:', e);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// POST /api/quiz/send-email
router.post('/send-email', async (req: Request, res: Response) => {
  try {
    const { email, firstName, recommendations, quizData } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const name = firstName || 'fellow camper';

    const campCards = (recommendations || []).slice(0, 8).map((r: any) => `
      <tr><td style="padding:12px 0;border-bottom:1px solid #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          ${r.imageUrl ? `<td width="80" style="vertical-align:top;padding-right:12px;"><img src="${r.imageUrl}" width="80" height="60" style="border-radius:8px;object-fit:cover;" /></td>` : ''}
          <td style="vertical-align:top;">
            <a href="https://www.rvunicorn.com/campgrounds/${r.id}" style="font-weight:700;color:#1a1a1a;text-decoration:none;font-size:15px;">${r.name}</a>
            <div style="color:#6b7280;font-size:13px;margin-top:2px;">${r.city ? `${r.city}, ` : ''}${r.state || ''}</div>
            <div style="color:#ea580c;font-size:13px;margin-top:4px;font-style:italic;">"${r.reason}"</div>
          </td>
        </tr></table>
      </td></tr>
    `).join('');

    const html = `
    <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="background:linear-gradient(135deg,#f59e0b,#ea580c);padding:24px;text-align:center;border-radius:12px 12px 0 0;">
        <h1 style="color:white;margin:0;font-size:24px;">🦄 RVUnicorn</h1>
        <p style="color:#fff9db;margin:8px 0 0;font-size:14px;">Your personalized campground picks</p>
      </div>
      <div style="padding:24px;background:#ffffff;border:1px solid #e5e7eb;border-top:0;">
        <p style="font-size:16px;color:#1a1a1a;">Hey ${name}! 👋</p>
        <p style="font-size:14px;color:#4b5563;line-height:1.6;">I'm Hitch, your campground co-pilot. Based on your quiz answers, I searched through 31,000+ campgrounds and hand-picked these just for you. 🏕️</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
          ${campCards}
        </table>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://www.rvunicorn.com/register?quiz=true" style="display:inline-block;background:#f59e0b;color:white;font-weight:700;padding:14px 28px;border-radius:12px;text-decoration:none;font-size:16px;">Complete Your RVUnicorn Profile →</a>
        </div>
        <p style="font-size:12px;color:#9ca3af;text-align:center;">Save your picks, plan trips, and connect with 50,000+ RV campers.</p>
      </div>
      <div style="text-align:center;padding:16px;color:#9ca3af;font-size:11px;">
        © RVUnicorn · The Social Platform for RV Campers
      </div>
    </div>`;

    await resend.emails.send({
      from: 'Hitch from RVUnicorn <hitch@updates.rvunicorn.com>',
      to: email,
      subject: `🦄 Your personalized campground picks are here, ${name}!`,
      html,
    });

    // Update lead
    await prisma.quizLead.updateMany({
      where: { email, emailSentAt: null },
      data: { emailSentAt: new Date(), firstName: firstName || undefined },
    });

    res.json({ success: true });
  } catch (e) {
    console.error('Quiz email error:', e);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

export default router;
