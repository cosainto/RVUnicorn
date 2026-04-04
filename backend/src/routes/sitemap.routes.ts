import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const SITE_URL = 'https://rvunicorn.com';
const today = new Date().toISOString().split('T')[0];

const BOARDS = [
  'ask', 'maintenance', 'upgrades', 'trip-planning', 'campground-tips',
  'recipes', 'trip-reports', 'family', 'pets', 'humor',
];

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/community', priority: '0.7', changefreq: 'daily' },
  { path: '/campgrounds', priority: '0.8', changefreq: 'weekly' },
  { path: '/travel', priority: '0.5', changefreq: 'monthly' },
  { path: '/badges', priority: '0.5', changefreq: 'monthly' },
];

router.get('/', async (_req: Request, res: Response) => {
  try {
    const campgrounds = await prisma.campground.findMany({
      select: { id: true, customSlug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 50000,
    });

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    for (const page of STATIC_PAGES) {
      xml += `  <url>\n    <loc>${SITE_URL}${page.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>\n`;
    }

    // Community boards
    for (const slug of BOARDS) {
      xml += `  <url>\n    <loc>${SITE_URL}/community/${slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }

    // Campground pages — use customSlug when available, fall back to id
    for (const cg of campgrounds) {
      const slug = cg.customSlug || cg.id;
      const lastmod = cg.updatedAt ? cg.updatedAt.toISOString().split('T')[0] : today;
      xml += `  <url>\n    <loc>${SITE_URL}/campgrounds/${slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(xml);
  } catch (e) {
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

export default router;
