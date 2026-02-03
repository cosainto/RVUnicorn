import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function timeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let t: any;
  return Promise.race([
    promise,
    new Promise<null>(r => { t = setTimeout(() => r(null), ms); }),
  ]).finally(() => clearTimeout(t));
}

async function grab(url: string): Promise<string | null> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    const r = await fetch(url, {
      signal: ac.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      redirect: 'follow',
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('image/') || ct.includes('application/pdf')) return 'BINARY';
    return await r.text();
  } catch { return null; }
}

async function exists(url: string): Promise<boolean> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    const r = await fetch(url, { method: 'HEAD', signal: ac.signal, headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}

function resolve(base: string, rel: string): string {
  try {
    if (rel.startsWith('http')) return rel;
    if (rel.startsWith('//')) return 'https:' + rel;
    return new URL(rel, base).href;
  } catch { return rel; }
}

function origin(url: string): string {
  try { return new URL(url).origin; } catch { return url; }
}

function score(url: string, txt: string): number {
  var b = (url + ' ' + txt).toLowerCase();
  var s = 0;
  if (/campground[\s_-]?map/.test(b)) s += 60;
  if (/campsite[\s_-]?map/.test(b)) s += 60;
  if (/rv[\s_-]?park[\s_-]?map/.test(b)) s += 55;
  if (/camp[\s_-]?map/.test(b)) s += 55;
  if (/site[\s_-]?map/.test(b) && !/sitemap\.xml/.test(b)) s += 50;
  if (/park[\s_-]?map/.test(b)) s += 45;
  if (/facility[\s_-]?map/.test(b)) s += 45;
  if (/resort[\s_-]?map/.test(b)) s += 40;
  if (/property[\s_-]?map/.test(b)) s += 40;
  if (/layout[\s_-]?map/.test(b)) s += 50;
  if (/trail[\s_-]?map/.test(b)) s += 30;
  if (/area[\s_-]?map/.test(b)) s += 25;
  if (/\.(jpg|jpeg|png|gif|webp|svg|pdf)(\?|$)/.test(url.toLowerCase())) s += 15;
  if (/\.pdf(\?|$)/.test(url.toLowerCase())) s += 10;
  if (/sitemap\.xml/.test(b)) return -100;
  if (/google\.com\/maps|maps\.google|goo\.gl\/maps/.test(b)) return -100;
  if (/directions|weather|favicon|logo|icon|avatar|social/.test(b)) return -50;
  if (/(facebook|twitter|instagram|youtube|pinterest)/.test(url.toLowerCase())) return -100;
  return s;
}

interface Hit { url: string; score: number; src: string; }

function scan(html: string, base: string): Hit[] {
  var hits: Hit[] = [];
  var m;
  var re1 = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = re1.exec(html)) !== null) {
    var href = m[1].trim();
    var txt = m[2].replace(/<[^>]*>/g, '').trim();
    if (!href || href === '#' || href.startsWith('javascript:')) continue;
    var full = resolve(base, href);
    var s = score(full, txt);
    if (s > 20) hits.push({ url: full, score: s, src: 'link' });
  }
  var re2 = /<img\s[^>]*src=["']([^"']+)["'][^>]*>/gi;
  while ((m = re2.exec(html)) !== null) {
    var tag = m[0];
    var src2 = m[1].trim();
    var am = tag.match(/alt=["']([^"']*?)["']/i);
    var alt = am ? am[1] : '';
    var full2 = resolve(base, src2);
    var s2 = score(full2, alt);
    if (s2 > 20) hits.push({ url: full2, score: s2 + 5, src: 'img' });
  }
  var re3 = /<(?:embed|object|iframe)\s[^>]*(?:src|data)=["']([^"']+)["'][^>]*>/gi;
  while ((m = re3.exec(html)) !== null) {
    var esrc = m[1].trim();
    var efull = resolve(base, esrc);
    if (/\.pdf|map/i.test(efull)) {
      var es = score(efull, 'embedded map');
      if (es > 10) hits.push({ url: efull, score: es + 10, src: 'embed' });
    }
  }
  return hits;
}

async function findMap(name: string, site: string): Promise<Hit | null> {
  var all: Hit[] = [];

  var html = await grab(site);
  if (html && html !== 'BINARY') {
    all.push.apply(all, scan(html, site));
  }

  var best = 0;
  for (var h of all) { if (h.score > best) best = h.score; }

  if (best < 50) {
    var o = origin(site);
    var paths = ['/map', '/campground-map', '/park-map', '/site-map', '/camp-map',
      '/map.pdf', '/campground-map.pdf', '/park-map.pdf', '/facility-map', '/resort-map'];
    for (var p of paths) {
      if (await exists(o + p)) {
        var ps = score(o + p, p);
        if (ps > 15) { all.push({ url: o + p, score: ps + 10, src: 'path' }); break; }
      }
    }
  }

  var pages = all.filter(function(h) { return h.score > 30 && !/\.(jpg|jpeg|png|gif|webp|svg|pdf)(\?|$)/i.test(h.url); });
  pages.sort(function(a, b) { return b.score - a.score; });
  if (pages.length > 0) {
    var sub = await grab(pages[0].url);
    if (sub && sub !== 'BINARY') {
      var subhits = scan(sub, pages[0].url);
      for (var sh of subhits) { all.push({ url: sh.url, score: sh.score + 30, src: 'subpage' }); }
    }
  }

  var ln = name.toLowerCase();
  if (ln.includes('koa') && await exists(origin(site) + '/activities-map')) {
    all.push({ url: origin(site) + '/activities-map', score: 45, src: 'koa' });
  }
  if ((ln.includes('thousand trails') || ln.includes('sun outdoors') || ln.includes('encore')) && await exists(origin(site) + '/resort-map')) {
    all.push({ url: origin(site) + '/resort-map', score: 45, src: 'chain' });
  }

  if (all.length === 0) return null;

  var seen = new Set<string>();
  all = all.filter(function(h) { if (seen.has(h.url)) return false; seen.add(h.url); return true; });
  all.sort(function(a, b) { return b.score - a.score; });

  if (all[0].score < 25) return null;

  if (await exists(all[0].url)) return all[0];
  if (all.length > 1 && all[1].score >= 25 && await exists(all[1].url)) return all[1];
  return null;
}

async function main() {
  console.log('CAMPGROUND MAP SCRAPER');
  console.log('Loading...');

  var camps = await prisma.campground.findMany({
    select: { id: true, name: true, state: true, websiteUrl: true, campgroundMapUrl: true },
    orderBy: { name: 'asc' },
  });

  console.log('Total: ' + camps.length);

  var todo = camps.filter(function(c) { return !c.campgroundMapUrl && c.websiteUrl; });
  var already = camps.length - camps.filter(function(c) { return !c.campgroundMapUrl; }).length;

  console.log('Already have map: ' + already);
  console.log('To scrape: ' + todo.length);
  console.log('GO');
  console.log('');

  var found = 0;
  var miss = 0;
  var errs = 0;
  var sources: Record<string, number> = {};

  for (var i = 0; i < todo.length; i++) {
    var c = todo[i];
    var hit: Hit | null = null;

    try {
      hit = await timeout(findMap(c.name, c.websiteUrl!), 25000);
    } catch (e) {
      hit = null;
    }

    if (hit) {
      try {
        await prisma.campground.update({ where: { id: c.id }, data: { campgroundMapUrl: hit.url } });
        found++;
        sources[hit.src] = (sources[hit.src] || 0) + 1;
        console.log('[' + (i+1) + '] ' + c.name + ' (' + c.state + ') YES ' + hit.src + ' ' + hit.score);
      } catch (e) {
        errs++;
      }
    } else {
      miss++;
    }

    if ((i + 1) % 100 === 0) {
      console.log('=== ' + (i+1) + '/' + todo.length + ' found=' + found + ' miss=' + miss + ' err=' + errs + ' ===');
    }
  }

  var total = await prisma.campground.count();
  var withMap = await prisma.campground.count({ where: { campgroundMapUrl: { not: null } } });

  console.log('');
  console.log('DONE');
  console.log('Found: ' + found);
  console.log('Miss: ' + miss);
  console.log('Err: ' + errs);
  console.log('Total with maps: ' + withMap + '/' + total);
  console.log('Sources:');
  for (var key in sources) { console.log('  ' + key + ': ' + sources[key]); }
}

main().catch(console.error).finally(function() { process.exit(); });
