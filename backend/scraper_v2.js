const {PrismaClient} = require('@prisma/client');
const https = require('https');
const http = require('http');
const fs = require('fs');
const p = new PrismaClient();
const LOG = process.env.HOME + '/Downloads/scraper2.log';
const log = m => { const l = new Date().toISOString() + ' ' + m; console.log(l); fs.appendFileSync(LOG, l+'\n'); };

process.on('uncaughtException', e => log('UNCAUGHT: ' + e.message));
process.on('unhandledRejection', e => log('UNHANDLED: ' + String(e)));

function fetchPage(url, hops) {
  hops = hops || 0;
  return new Promise(function(res) {
    if (hops > 3 || !url) return res(null);
    try {
      var u = new URL(url);
      var m = u.protocol === 'https:' ? https : http;
      var r = m.get(url, {timeout: 7000, headers: {'User-Agent': 'RVUnicorn/1.0'}}, function(resp) {
        if ([301,302,307,308].includes(resp.statusCode) && resp.headers.location) {
          var next = resp.headers.location.startsWith('http')
            ? resp.headers.location
            : u.origin + resp.headers.location;
          return res(fetchPage(next, hops + 1));
        }
        if (resp.statusCode !== 200) return res(null);
        var b = '';
        resp.setEncoding('utf8');
        resp.on('data', function(c) { b += c; if (b.length > 300000) resp.destroy(); });
        resp.on('end', function() { res(b); });
        resp.on('error', function() { res(null); });
      });
      r.on('timeout', function() { r.destroy(); res(null); });
      r.on('error', function() { res(null); });
    } catch(e) { res(null); }
  });
}

function extractSocials(html) {
  if (!html) return {};
  var result = {};
  var re = /href=["']([^"']+)["']/gi;
  var match;
  while ((match = re.exec(html)) !== null) {
    var h = match[1];
    var l = h.toLowerCase();
    if (!result.facebookUrl && l.includes('facebook.com/') && !l.includes('sharer') && !l.includes('dialog') && !l.includes('plugins') && !l.includes('/tr?')) {
      try { var fu = new URL(h); if (fu.pathname.length > 1) result.facebookUrl = 'https://facebook.com' + fu.pathname.replace(/\/$/, ''); } catch(e) {}
    }
    if (!result.instagramUrl && l.includes('instagram.com/') && !l.includes('/p/') && !l.includes('share')) {
      try { var iu = new URL(h); if (iu.pathname.length > 1) result.instagramUrl = 'https://instagram.com' + iu.pathname.replace(/\/$/, ''); } catch(e) {}
    }
    if (!result.twitterUrl && (l.includes('twitter.com/') || l.includes('x.com/')) && !l.includes('share') && !l.includes('intent')) {
      result.twitterUrl = h.split('?')[0];
    }
    if (!result.youtubeUrl && l.includes('youtube.com/') && !l.includes('/watch') && !l.includes('embed')) {
      result.youtubeUrl = h.split('?')[0];
    }
    if (!result.tiktokUrl && l.includes('tiktok.com/@')) {
      result.tiktokUrl = h.split('?')[0];
    }
  }
  return result;
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function run() {
  fs.writeFileSync(LOG, '');
  log('Starting scraper v2');

  var cgs = await p.campground.findMany({
    where: { websiteUrl: { not: null } },
    select: { id: true, name: true, websiteUrl: true, facebookUrl: true, instagramUrl: true, twitterUrl: true, youtubeUrl: true, tiktokUrl: true },
    orderBy: { id: 'asc' }
  });

  log('Total campgrounds with website: ' + cgs.length);

  var done = 0, updated = 0, skipped = 0, failed = 0;

  for (var i = 0; i < cgs.length; i++) {
    var cg = cgs[i];
    done++;

    if (cg.facebookUrl && cg.instagramUrl) {
      skipped++;
      if (done % 500 === 0) log('Progress: ' + done + '/' + cgs.length + ' updated:' + updated + ' skipped:' + skipped + ' failed:' + failed);
      continue;
    }

    var url = cg.websiteUrl;
    if (!url.startsWith('http')) url = 'https://' + url;

    var html = null;
    try { html = await fetchPage(url); } catch(e) { html = null; }

    if (!html) {
      failed++;
      if (done % 100 === 0) log('Progress: ' + done + '/' + cgs.length + ' updated:' + updated + ' skipped:' + skipped + ' failed:' + failed);
      await sleep(800);
      continue;
    }

    var s = extractSocials(html);
    var upd = {};
    if (!cg.facebookUrl && s.facebookUrl) upd.facebookUrl = s.facebookUrl;
    if (!cg.instagramUrl && s.instagramUrl) upd.instagramUrl = s.instagramUrl;
    if (!cg.twitterUrl && s.twitterUrl) upd.twitterUrl = s.twitterUrl;
    if (!cg.youtubeUrl && s.youtubeUrl) upd.youtubeUrl = s.youtubeUrl;
    if (!cg.tiktokUrl && s.tiktokUrl) upd.tiktokUrl = s.tiktokUrl;

    if (Object.keys(upd).length > 0) {
      try {
        await p.campground.update({ where: { id: cg.id }, data: upd });
        updated++;
        log('OK ' + cg.name + ': ' + Object.keys(upd).join(', '));
      } catch(e) {
        log('DB err ' + cg.name + ': ' + e.message);
      }
    }

    if (done % 100 === 0) log('Progress: ' + done + '/' + cgs.length + ' updated:' + updated + ' skipped:' + skipped + ' failed:' + failed);
    await sleep(1200);
  }

  log('DONE. Updated:' + updated + ' Skipped:' + skipped + ' Failed:' + failed);
  await p.$disconnect();
}

run().catch(function(e) {
  log('FATAL: ' + e.message);
  process.exit(1);
});
