import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { renderCampgroundPage, renderCommunityBoardPage } from '../utils/campgroundSSR';

const router = Router();

const CRAWLER_UA = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot/i;

function shouldSSR(req: Request): boolean {
  const isCrawler = CRAWLER_UA.test(req.headers['user-agent'] || '');
  const isDirectLoad = req.headers.accept?.includes('text/html') && !req.headers['x-requested-with'];
  return isCrawler || !!isDirectLoad;
}

// SSR for campground pages
router.get('/campgrounds/:slug', async (req: Request, res: Response, next: NextFunction) => {
  if (!shouldSSR(req)) {
    return next();
  }

  try {
    const { slug } = req.params;

    // Look up by customSlug first, then by id
    const campground = await prisma.campground.findFirst({
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

    const reviews = await prisma.campgroundReview.findMany({
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

    const events = await prisma.campgroundEvent.findMany({
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
  } catch (error) {
    console.error('SSR campground error:', error);
    res.status(500).send('Server error');
  }
});

// SSR for public trip view — always serve for crawlers AND direct loads
router.get('/trips/:slug/view', async (req: Request, res: Response, next: NextFunction) => {
  if (!shouldSSR(req)) return next();
  try {
    const { slug } = req.params;
    const trip = await prisma.event.findFirst({
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
<meta property="og:url" content="https://rvunicorn.com/trips/${slug}/view">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${trip.title}">
<meta name="twitter:image" content="${photo}">
<link rel="canonical" href="https://rvunicorn.com/trips/${slug}/view">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Trip","name":"${trip.title}","description":"${trip.description || ''}","touristType":"RV Travelers"}</script>
</head><body style="background:#0F1C35;color:#F5F0E8;font-family:sans-serif;margin:0">
<div id="ssr-content" style="max-width:700px;margin:0 auto;padding:20px">
<h1>${trip.title}</h1><p>A trip by ${ownerName}</p>
<p>${trip.startDate.toLocaleDateString()} — ${trip.endDate.toLocaleDateString()} · ${days} days</p>
${trip.description ? `<p>${trip.description}</p>` : ''}
<p><a href="https://rvunicorn.com" style="color:#E8A838">Join RVUnicorn free →</a></p>
</div>
<div id="root"></div><script type="module" src="/src/main.tsx"></script>
<script>document.addEventListener('DOMContentLoaded',function(){var r=document.getElementById('root');var o=new MutationObserver(function(){if(r.children.length>0){document.getElementById('ssr-content')?.remove();o.disconnect()}});o.observe(r,{childList:true})})</script>
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
  } catch (error) {
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
    const [campgrounds, users] = await Promise.all([
      prisma.campground.findMany({
        select: { id: true, customSlug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 50000,
      }),
      prisma.user.findMany({
        select: { username: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 50000,
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
      xml += `  <url>\n    <loc>https://rvunicorn.com/community/${slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }

    // Campground pages
    for (const cg of campgrounds) {
      const slug = cg.customSlug || cg.id;
      const lastmod = cg.updatedAt ? cg.updatedAt.toISOString().split('T')[0] : today;
      xml += `  <url>\n    <loc>https://rvunicorn.com/campgrounds/${slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    // User profile pages
    for (const u of users) {
      const lastmod = u.updatedAt ? u.updatedAt.toISOString().split('T')[0] : today;
      xml += `  <url>\n    <loc>https://rvunicorn.com/profile/${u.username}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(xml);
  } catch (e) {
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

Sitemap: https://rvunicorn.com/sitemap.xml
`;

  res.set('Content-Type', 'text/plain');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(robotsTxt);
});

export default router;
