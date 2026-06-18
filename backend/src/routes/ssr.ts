import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { renderCampgroundPage, renderCommunityBoardPage } from '../utils/campgroundSSR';

const router = Router();
const db = prisma as any;

const CRAWLER_UA = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot/i;

function shouldSSR(req: Request): boolean {
  const isCrawler = CRAWLER_UA.test(req.headers['user-agent'] || '');
  const isDirectLoad = req.headers.accept?.includes('text/html') && !req.headers['x-requested-with'];
  return isCrawler || !!isDirectLoad;
}

// SSR for landing page — give crawlers real HTML content
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  if (!CRAWLER_UA.test(req.headers['user-agent'] || '')) return next();

  try {
    // Fetch some stats to make the page rich
    const [campgroundCount, userCount, boardCount] = await Promise.all([
      db.campground.count(),
      db.user.count(),
      (prisma as any).board.count({ where: { isActive: true } }),
    ]);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RVUnicorn — The Social Campground Community for RV Travelers</title>
  <meta name="description" content="RVUnicorn is the social campground community for RV travelers. Find campgrounds, plan trips, connect with fellow RVers, and get AI-powered travel tips from Hitch.">
  <meta name="keywords" content="RVUnicorn, RV community, campground finder, RV travel, camping social network, RV trip planner, boondocking, full-time RV">
  <link rel="canonical" href="https://www.rvunicorn.com/">
  <meta property="og:title" content="RVUnicorn — The Social Campground Community for RV Travelers">
  <meta property="og:description" content="Find campgrounds, plan trips, connect with fellow RVers. Your campfire, wherever you park.">
  <meta property="og:image" content="https://www.rvunicorn.com/images/Logo_RVUnicorn.png">
  <meta property="og:url" content="https://www.rvunicorn.com/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="RVUnicorn">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="RVUnicorn — The Social Campground Community for RV Travelers">
  <meta name="twitter:description" content="Find campgrounds, plan trips, connect with fellow RVers. Your campfire, wherever you park.">
  <meta name="twitter:image" content="https://www.rvunicorn.com/images/Logo_RVUnicorn.png">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "RVUnicorn",
    "alternateName": "RV Unicorn",
    "url": "https://www.rvunicorn.com",
    "logo": "https://www.rvunicorn.com/images/Logo_RVUnicorn.png",
    "description": "RVUnicorn is the social campground community for RV travelers. Find campgrounds, plan trips, connect with fellow RVers, and get AI-powered travel tips.",
    "foundingDate": "2025"
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "RVUnicorn",
    "alternateName": "RV Unicorn",
    "url": "https://www.rvunicorn.com",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://www.rvunicorn.com/campgrounds?search={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }
  </script>
</head>
<body>
  <header>
    <h1>RVUnicorn — The Social Campground Community for RV Travelers</h1>
    <p>Your campfire, wherever you park.</p>
  </header>
  <main>
    <section>
      <h2>What is RVUnicorn?</h2>
      <p>RVUnicorn is the social campground community built for RV travelers. Whether you're a full-timer, weekender, or somewhere in between — RVUnicorn helps you find the perfect campground, plan your next trip, and connect with RVers who get it.</p>
      <p>Meet Hitch, your AI-powered campground co-pilot. Hitch knows the campgrounds, answers your questions in real-time campfire chat, and suggests the best spots based on your rig type and travel style.</p>
    </section>
    <section>
      <h2>RVUnicorn by the Numbers</h2>
      <ul>
        <li>${campgroundCount.toLocaleString()} campgrounds listed</li>
        <li>${userCount.toLocaleString()} RVers in the community</li>
        <li>${boardCount} active community boards</li>
      </ul>
    </section>
    <section>
      <h2>Features</h2>
      <ul>
        <li>Campground Directory — Search and discover campgrounds with real reviews, amenities, and rig-size compatibility</li>
        <li>Trip Planner — Plan routes, manage checklists, and track your travels across all 50 states</li>
        <li>Campfire Chat — Real-time chat at every campground with AI characters Hitch, Walter, and Scout</li>
        <li>Community Boards — Share trip reports, ask questions, swap recipes, and connect with fellow RVers</li>
        <li>Drive Mode — Fatigue scoring, break planning, and passenger/driver split for safe road trips</li>
        <li>Rig Memory — Your RV's digital identity: maintenance logs, trip history, and photo albums</li>
        <li>Events — Host campground events with RSVP, schedules, and meal planning</li>
      </ul>
    </section>
    <section>
      <h2>For Campground Owners</h2>
      <p>RVUnicorn offers campground management tools with the Summit subscription: broadcast messages to guests, let Hitch answer FAQs automatically, track repeat visitors, and run events with Mission Mode.</p>
    </section>
    <nav>
      <a href="/campgrounds">Browse Campgrounds</a>
      <a href="/community">Community</a>
      <a href="/register">Join RVUnicorn</a>
      <a href="/login">Sign In</a>
    </nav>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} RVUnicorn. All rights reserved.</p>
  </footer>
</body>
</html>`;

    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (e: any) {
    console.error('[SSR] Landing page error:', e);
    next();
  }
});

// SSR for campground pages
router.get('/campgrounds/:slug', async (req: Request, res: Response, next: NextFunction) => {
  if (!shouldSSR(req)) {
    return next();
  }

  try {
    const { slug } = req.params;

    // Look up by customSlug first, then by id
    const campground = await db.campground.findFirst({
      where: {
        OR: [
          { customSlug: slug },
          { id: slug },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        location: true,
        state: true,
        latitude: true,
        longitude: true,
        amenities: true,
        customSlug: true,
        imageUrl: true,
        websiteUrl: true,
        businessPhone: true,
        phone: true,
        googleRating: true,
        photos: {
          where: { status: 'APPROVED' },
          select: { imageUrl: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            followers: true,
            checkIns: true,
            reviews: true,
            photos: true,
          },
        },
      },
    });

    if (!campground) {
      return res.status(404).send('Campground not found');
    }

    const reviews = await db.campgroundReview.findMany({
      where: { campgroundId: campground.id },
      select: {
        rating: true,
        review: true,
        title: true,
        createdAt: true,
        user: {
          select: { firstName: true, lastName: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const events = await db.campgroundEvent.findMany({
      where: {
        campgroundId: campground.id,
        startDate: { gte: new Date() },
      },
      select: {
        title: true,
        startDate: true,
        description: true,
      },
      orderBy: { startDate: 'asc' },
      take: 5,
    });

    const stats = {
      followers: campground._count.followers,
      checkIns: campground._count.checkIns,
      reviews: campground._count.reviews,
      photos: campground._count.photos,
    };

    const html = renderCampgroundPage(campground, stats, reviews, events);
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (error: any) {
    console.error('SSR campground error:', error);
    res.status(500).send('Server error');
  }
});

// SSR for public trip view — always serve for crawlers AND direct loads
router.get('/trips/:slug/view', async (req: Request, res: Response, next: NextFunction) => {
  if (!shouldSSR(req)) return next();
  try {
    const { slug } = req.params;
    const trip = await db.event.findFirst({
      where: { OR: [{ tripSlug: slug }, { id: slug }] },
      include: { organizer: { select: { firstName: true, lastName: true } }, campground: { select: { name: true, state: true, imageUrl: true } } },
    });
    if (!trip || !trip.isPublic) return next();

    const ownerName = `${trip.organizer.firstName} ${trip.organizer.lastName}`;
    const photo = trip.campground?.imageUrl || 'https://res.cloudinary.com/dy6eetmh7/image/upload/w_1200,h_630,c_pad,b_rgb:1a2e4a/v1774218289/rvunicorn/Logo_RVUnicorn.png';
    const days = Math.ceil((trip.endDate.getTime() - trip.startDate.getTime()) / 86400000);

    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${trip.title} — ${ownerName}'s RV Trip on RVUnicorn</title>
<meta name="description" content="Follow ${ownerName}'s ${days}-day road trip. ${trip.campground?.name ? `Starting at ${trip.campground.name}` : ''} on RVUnicorn.">
<meta property="og:title" content="${trip.title}">
<meta property="og:description" content="${ownerName} is on a ${days}-day RV trip. Follow along on RVUnicorn.">
<meta property="og:image" content="${photo}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="https://www.rvunicorn.com/trips/${slug}/view">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${trip.title}">
<meta name="twitter:image" content="${photo}">
<link rel="canonical" href="https://www.rvunicorn.com/trips/${slug}/view">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Trip","name":"${trip.title}","description":"${trip.description || ''}","touristType":"RV Travelers"}</script>
</head><body style="background:#0F1C35;color:#F5F0E8;font-family:sans-serif;margin:0">
<div id="ssr-content" style="max-width:700px;margin:0 auto;padding:20px">
<h1>${trip.title}</h1><p>A trip by ${ownerName}</p>
<p>${trip.startDate.toLocaleDateString()} — ${trip.endDate.toLocaleDateString()} · ${days} days</p>
${trip.description ? `<p>${trip.description}</p>` : ''}
<p><a href="https://www.rvunicorn.com" style="color:#E8A838">Join RVUnicorn free →</a></p>
</div>
<div id="root"></div><script type="module" src="/src/main.tsx"></script>
<script>document.addEventListener('DOMContentLoaded',function(){var r=document.getElementById('root');var o=new MutationObserver(function(){if(r.children.length>0){document.getElementById('ssr-content')?.remove();o.disconnect()}});o.observe(r,{childList:true})})</script>
</body></html>`;
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch { next(); }
});

// SSR for /rig/:slug (public rig profile)
router.get('/rig/:slug', async (req: Request, res: Response, next: NextFunction) => {
  if (!shouldSSR(req)) return next();
  try {
    const { slug } = req.params;
    const rig = await db.rig.findUnique({
      where: { slug },
      include: { owner: { select: { firstName: true, lastName: true } } },
    });
    if (!rig || !rig.isPublic) return next();

    const title = rig.rigName || `${rig.year || ''} ${rig.make || ''} ${rig.model || ''}`.trim();
    const photo = rig.heroPhoto || 'https://res.cloudinary.com/dy6eetmh7/image/upload/w_1200,h_630,c_pad,b_rgb:1a2e4a/v1774218289/rvunicorn/Logo_RVUnicorn.png';
    const ownerName = `${rig.owner.firstName} ${rig.owner.lastName}`;

    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} · RVUnicorn</title>
<meta name="description" content="${title} — ${rig.totalTripCount || 0} trips, ${rig.totalStatesCount || 0} states, ${Math.round(rig.totalMilesDriven || 0)} miles. Follow ${ownerName}'s RV on RVUnicorn.">
<meta property="og:title" content="${title} on RVUnicorn">
<meta property="og:description" content="${rig.year || ''} ${rig.make || ''} ${rig.model || ''} · ${rig.totalTripCount || 0} trips · ${rig.totalStatesCount || 0} states">
<meta property="og:image" content="${photo}">
<meta property="og:url" content="https://www.rvunicorn.com/rig/${slug}">
<link rel="canonical" href="https://www.rvunicorn.com/rig/${slug}">
</head><body style="background:#0F1C35;color:#F5F0E8;font-family:sans-serif;margin:0">
<div id="ssr-content" style="max-width:700px;margin:0 auto;padding:20px">
<h1>${title}</h1><p>Piloted by ${ownerName}</p>
<p>${rig.totalTripCount || 0} trips · ${rig.totalStatesCount || 0} states · ${Math.round(rig.totalMilesDriven || 0)} miles</p>
<p><a href="https://www.rvunicorn.com/register" style="color:#E8A838">Join RVUnicorn free →</a></p>
</div>
<div id="root"></div><script type="module" src="/src/main.tsx"></script>
<script>document.addEventListener('DOMContentLoaded',function(){var r=document.getElementById('root');var o=new MutationObserver(function(){if(r.children.length>0){document.getElementById('ssr-content')?.remove();o.disconnect()}});o.observe(r,{childList:true})})</script>
</body></html>`;
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch { next(); }
});

// SSR for /t/:tripId (new public trip route)
router.get('/t/:tripId', async (req: Request, res: Response, next: NextFunction) => {
  if (!shouldSSR(req)) return next();
  try {
    const { tripId } = req.params;
    const trip = await db.event.findFirst({
      where: { OR: [{ id: tripId }, { tripSlug: tripId }], isPublic: true },
      include: { organizer: { select: { firstName: true, lastName: true, rvMake: true, rvModel: true, rvYear: true } }, campground: { select: { name: true, state: true, imageUrl: true } } },
    });
    if (!trip) return next();

    const ownerName = `${trip.organizer.firstName} ${trip.organizer.lastName}`;
    const photo = trip.coverImage || trip.campground?.imageUrl || 'https://res.cloudinary.com/dy6eetmh7/image/upload/w_1200,h_630,c_pad,b_rgb:1a2e4a/v1774218289/rvunicorn/Logo_RVUnicorn.png';
    const days = trip.endDate ? Math.ceil((trip.endDate.getTime() - trip.startDate.getTime()) / 86400000) : null;
    const rig = [trip.organizer.rvYear, trip.organizer.rvMake, trip.organizer.rvModel].filter(Boolean).join(' ');

    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${ownerName}'s Trip to ${trip.campground?.name || trip.title} · RVUnicorn</title>
<meta name="description" content="${ownerName} took their ${rig || 'RV'} to ${trip.campground?.name || trip.title}${days ? ` for ${days} days` : ''}. See the campgrounds, route, and photos on RVUnicorn.">
<meta property="og:title" content="${ownerName}'s RV Trip to ${trip.campground?.name || trip.title}">
<meta property="og:description" content="${days ? `${days}-day trip` : 'RV trip'}${trip.campground ? ` · ${trip.campground.name}` : ''}${rig ? ` · ${rig}` : ''}">
<meta property="og:image" content="${photo}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="https://www.rvunicorn.com/t/${tripId}">
<meta property="og:type" content="article"><meta property="og:site_name" content="RVUnicorn">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${ownerName}'s RV Trip">
<meta name="twitter:image" content="${photo}">
<link rel="canonical" href="https://www.rvunicorn.com/t/${tripId}">
</head><body style="background:#0F1C35;color:#F5F0E8;font-family:sans-serif;margin:0">
<div id="ssr-content" style="max-width:700px;margin:0 auto;padding:20px">
<h1>${trip.title}</h1><p>A trip by ${ownerName}</p>
${trip.campground ? `<p>📍 ${trip.campground.name}${trip.campground.state ? `, ${trip.campground.state}` : ''}</p>` : ''}
${days ? `<p>${trip.startDate.toLocaleDateString()} — ${trip.endDate!.toLocaleDateString()} · ${days} days</p>` : ''}
<p><a href="https://www.rvunicorn.com/register" style="color:#E8A838">Join RVUnicorn free →</a></p>
</div>
<div id="root"></div><script type="module" src="/src/main.tsx"></script>
<script>document.addEventListener('DOMContentLoaded',function(){var r=document.getElementById('root');var o=new MutationObserver(function(){if(r.children.length>0){document.getElementById('ssr-content')?.remove();o.disconnect()}});o.observe(r,{childList:true})})</script>
</body></html>`;
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch { next(); }
});

// SSR for /route/:token (shared saved trip)
router.get('/route/:token', async (req: Request, res: Response, next: NextFunction) => {
  if (!shouldSSR(req)) return next();
  try {
    const trip = await db.savedTrip.findFirst({
      where: { shareToken: req.params.token },
      include: { user: { select: { firstName: true, lastName: true } }, campground: { select: { name: true, state: true, imageUrl: true } } },
    });
    if (!trip) return next();
    const ownerName = `${trip.user.firstName} ${trip.user.lastName}`;
    const miles = Math.round(trip.distanceMeters * 0.000621371);
    const hours = Math.floor(trip.durationSeconds / 3600);
    const photo = trip.campground?.imageUrl || 'https://res.cloudinary.com/dy6eetmh7/image/upload/w_1200,h_630,c_pad,b_rgb:1a2e4a/v1774218289/rvunicorn/Logo_RVUnicorn.png';
    const desc = `${trip.originAddress} → ${trip.destinationAddress} · ${miles} mi · ${hours}h drive${trip.estimatedFuelCost ? ` · $${trip.estimatedFuelCost.toFixed(0)} fuel` : ''}`;
    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${trip.name} · ${ownerName} · RVUnicorn</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${trip.name} — ${ownerName}'s Route">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${photo}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="https://www.rvunicorn.com/route/${req.params.token}">
<meta property="og:type" content="article"><meta property="og:site_name" content="RVUnicorn">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${trip.name}">
<meta name="twitter:image" content="${photo}">
<link rel="canonical" href="https://www.rvunicorn.com/route/${req.params.token}">
</head><body style="background:#0F1C35;color:#F5F0E8;font-family:sans-serif;margin:0">
<div id="ssr-content" style="max-width:700px;margin:0 auto;padding:20px">
<h1>${trip.name}</h1><p>A route by ${ownerName}</p>
<p>${trip.originAddress} → ${trip.destinationAddress}</p>
<p>${miles} miles · ${hours}h drive</p>
<p><a href="https://www.rvunicorn.com/register" style="color:#E8A838">Plan your own trip on RVUnicorn →</a></p>
</div>
<div id="root"></div><script type="module" src="/src/main.tsx"></script>
<script>document.addEventListener('DOMContentLoaded',function(){var r=document.getElementById('root');var o=new MutationObserver(function(){if(r.children.length>0){document.getElementById('ssr-content')?.remove();o.disconnect()}});o.observe(r,{childList:true})})</script>
</body></html>`;
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch { next(); }
});

// SSR for /u/:username (public profile)
router.get('/u/:username', async (req: Request, res: Response, next: NextFunction) => {
  if (!shouldSSR(req)) return next();
  try {
    const { username } = req.params;
    const user = await db.user.findUnique({
      where: { username },
      select: { firstName: true, lastName: true, profilePicture: true, rvMake: true, rvModel: true, rvYear: true, createdAt: true },
    });
    if (!user) return next();

    const name = `${user.firstName} ${user.lastName}`;
    const rig = [user.rvYear, user.rvMake, user.rvModel].filter(Boolean).join(' ');
    const photo = user.profilePicture || 'https://res.cloudinary.com/dy6eetmh7/image/upload/w_1200,h_630,c_pad,b_rgb:1a2e4a/v1774218289/rvunicorn/Logo_RVUnicorn.png';

    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name} · RVUnicorn Member</title>
<meta name="description" content="${name} is an RV traveler on RVUnicorn${rig ? `, traveling in a ${rig}` : ''}. See their adventures.">
<meta property="og:title" content="${name} · RVUnicorn"><meta property="og:image" content="${photo}">
<meta property="og:url" content="https://www.rvunicorn.com/u/${username}">
<link rel="canonical" href="https://www.rvunicorn.com/u/${username}">
</head><body style="background:#0F1C35;color:#F5F0E8;font-family:sans-serif;margin:0">
<div id="ssr-content" style="max-width:700px;margin:0 auto;padding:20px;text-align:center">
<h1>${name}</h1>${rig ? `<p>🚐 ${rig}</p>` : ''}
<p><a href="https://www.rvunicorn.com/register" style="color:#E8A838">Join RVUnicorn free →</a></p>
</div>
<div id="root"></div><script type="module" src="/src/main.tsx"></script>
<script>document.addEventListener('DOMContentLoaded',function(){var r=document.getElementById('root');var o=new MutationObserver(function(){if(r.children.length>0){document.getElementById('ssr-content')?.remove();o.disconnect()}});o.observe(r,{childList:true})})</script>
</body></html>`;
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch { next(); }
});

// SSR for public event pages
router.get('/events/:id', async (req: Request, res: Response, next: NextFunction) => {
  if (!CRAWLER_UA.test(req.headers['user-agent'] || '')) return next();
  try {
    const { id } = req.params;
    const event = await db.event.findUnique({
      where: { id },
      include: {
        organizer: { select: { firstName: true, lastName: true } },
        campground: { select: { name: true, state: true, city: true, imageUrl: true } },
        _count: { select: { attendees: true } },
      },
    });
    if (!event || event.privacy === 'PRIVATE') return next();

    const ownerName = `${event.organizer.firstName} ${event.organizer.lastName}`;
    const photo = event.campground?.imageUrl || 'https://res.cloudinary.com/dy6eetmh7/image/upload/w_1200,h_630,c_pad,b_rgb:1a2e4a/v1774218289/rvunicorn/Logo_RVUnicorn.png';
    const location = [event.campground?.name, event.campground?.city, event.campground?.state].filter(Boolean).join(', ');
    const desc = event.description
      ? event.description.slice(0, 160).replace(/"/g, '&quot;')
      : `${ownerName}'s RV event${location ? ` at ${location}` : ''} on RVUnicorn.`;

    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${event.title} — RV Event on RVUnicorn</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${event.title} — RVUnicorn">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${photo}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="https://www.rvunicorn.com/events/${id}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="RVUnicorn">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${event.title} — RVUnicorn">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${photo}">
<link rel="canonical" href="https://www.rvunicorn.com/events/${id}">
</head><body style="background:#0F1C35;color:#F5F0E8;font-family:sans-serif;margin:0">
<div id="root"></div>
</body></html>`;
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch { next(); }
});

// SSR for public scrapbook pages
router.get('/s/:token', async (req: Request, res: Response, next: NextFunction) => {
  if (!CRAWLER_UA.test(req.headers['user-agent'] || '')) return next();
  try {
    const { token } = req.params;
    const event = await db.event.findFirst({
      where: { scrapbookShareToken: token, scrapbookPublic: true },
      include: {
        organizer: { select: { firstName: true, lastName: true } },
        campground: { select: { name: true, state: true, imageUrl: true } },
      },
    });
    if (!event) return next();

    const ownerName = `${event.organizer.firstName} ${event.organizer.lastName}`;
    const photo = event.campground?.imageUrl || 'https://res.cloudinary.com/dy6eetmh7/image/upload/w_1200,h_630,c_pad,b_rgb:1a2e4a/v1774218289/rvunicorn/Logo_RVUnicorn.png';
    const desc = `${ownerName}'s trip photo album on RVUnicorn — the social campground community for RV travelers.`;

    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${event.title} — Trip Album on RVUnicorn</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${event.title} — Trip Album on RVUnicorn">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${photo}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="https://www.rvunicorn.com/s/${token}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="RVUnicorn">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${event.title} — Trip Album on RVUnicorn">
<meta name="twitter:image" content="${photo}">
<link rel="canonical" href="https://www.rvunicorn.com/s/${token}">
</head><body style="background:#0F1C35;color:#F5F0E8;font-family:sans-serif;margin:0">
<div id="root"></div>
</body></html>`;
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch { next(); }
});

// SSR for community board pages
router.get('/community/:boardSlug', async (req: Request, res: Response, next: NextFunction) => {
  if (!shouldSSR(req)) {
    return next();
  }

  try {
    const { boardSlug } = req.params;

    const board = await (prisma as any).board.findUnique({
      where: { slug: boardSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        postCount: true,
      },
    });

    if (!board) {
      return res.status(404).send('Board not found');
    }

    const posts = await (prisma as any).boardPost.findMany({
      where: { boardId: board.id },
      select: {
        title: true,
        body: true,
        createdAt: true,
        author: {
          select: { firstName: true, lastName: true, username: true },
        },
        _count: {
          select: { comments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Map boardPost shape to the template's expected shape
    const threads = posts.map((p: any) => ({
      title: p.title,
      content: p.body,
      author: p.author,
      createdAt: p.createdAt,
      _count: { posts: p._count.comments },
    }));

    const html = renderCommunityBoardPage(
      { name: board.name, slug: board.slug, postCount: board.postCount },
      threads
    );
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (error: any) {
    console.error('SSR community board error:', error);
    res.status(500).send('Server error');
  }
});

// Root-level sitemap.xml
const COMMUNITY_BOARDS = [
  'ask', 'maintenance', 'upgrades', 'trip-planning', 'campground-tips',
  'recipes', 'trip-reports', 'family', 'pets', 'humor',
];

router.get('/sitemap.xml', async (_req: Request, res: Response) => {
  try {
    const [campgrounds, users, publicTrips, publicRigs] = await Promise.all([
      db.campground.findMany({
        select: { id: true, customSlug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 50000,
      }),
      db.user.findMany({
        select: { username: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 50000,
      }),
      db.event.findMany({
        where: { isPublic: true },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10000,
      }),
      db.rig.findMany({
        where: { isPublic: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10000,
      }),
    ]);

    console.log(`Sitemap: ${campgrounds.length} campgrounds, ${users.length} profiles`);
    const today = new Date().toISOString().split('T')[0];
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    const staticPages = [
      { path: '/', priority: '1.0', freq: 'daily' },
      { path: '/campgrounds', priority: '0.9', freq: 'daily' },
      { path: '/trips', priority: '0.7', freq: 'daily' },
      { path: '/community', priority: '0.7', freq: 'daily' },
      { path: '/recipes', priority: '0.6', freq: 'weekly' },
      { path: '/travel', priority: '0.5', freq: 'monthly' },
      { path: '/badges', priority: '0.5', freq: 'monthly' },
    ];
    for (const p of staticPages) {
      xml += `  <url>\n    <loc>https://rvunicorn.com${p.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.freq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
    }

    // Community boards
    for (const slug of COMMUNITY_BOARDS) {
      xml += `  <url>\n    <loc>https://www.rvunicorn.com/community/${slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }

    // Campground pages
    for (const cg of campgrounds) {
      const slug = cg.customSlug || cg.id;
      const lastmod = cg.updatedAt ? cg.updatedAt.toISOString().split('T')[0] : today;
      xml += `  <url>\n    <loc>https://www.rvunicorn.com/campgrounds/${slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    // User profile pages
    for (const u of users) {
      const lastmod = u.updatedAt ? u.updatedAt.toISOString().split('T')[0] : today;
      xml += `  <url>\n    <loc>https://www.rvunicorn.com/u/${u.username}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
    }

    // Public trip pages
    for (const t of publicTrips) {
      const lastmod = t.updatedAt ? t.updatedAt.toISOString().split('T')[0] : today;
      xml += `  <url>\n    <loc>https://www.rvunicorn.com/t/${t.id}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
    }

    // Public rig pages
    for (const r of publicRigs) {
      const lastmod = r.updatedAt ? r.updatedAt.toISOString().split('T')[0] : today;
      xml += `  <url>\n    <loc>https://www.rvunicorn.com/rig/${r.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(xml);
  } catch (e: any) {
    console.error('Sitemap error:', e);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

// Root-level robots.txt
router.get('/robots.txt', (_req: Request, res: Response) => {
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /settings
Disallow: /messages
Disallow: /notifications

Sitemap: https://www.rvunicorn.com/sitemap.xml
`;

  res.set('Content-Type', 'text/plain');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(robotsTxt);
});

export default router;
