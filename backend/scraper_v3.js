const {PrismaClient} = require('@prisma/client');
const https = require('https');
const http = require('http');
const fs = require('fs');

const p = new PrismaClient();
const LOG = process.env.HOME + '/Downloads/scraper3.log';

function log(m) {
  const l = new Date().toISOString() + ' ' + m;
  console.log(l);
  fs.appendFileSync(LOG, l + '\n');
}

process.on('uncaughtException', function(e) { log('UNCAUGHT: ' + e.message + '\n' + e.stack); });
process.on('unhandledRejection', function(e) { log('UNHANDLED: ' + String(e)); });

function fetchPage(url, hops) {
  hops = hops || 0;
  return new Promise(function(res) {
    if (hops > 3 || !url) return res(null);
    try {
      var u = new URL(url);
      var mod = u.protocol === 'https:' ? https : http;
      var req = mod.get(url, {
        timeout: 7000,
        headers: { 'User-Agent': 'Mozilla/5.0 RVUnicorn/1.0' }
      }, function(resp) {
        if ([301,302,307,308].indexOf(resp.statusCode) !== -1 && resp.headers.location) {
          var next = resp.headers.location.startsWith('http')
            ? resp.headers.location
            : u.protocol + '//' + u.host + resp.headers.location;
          resp.resume();
          return res(fetchPage(next, hops + 1));
        }
        if (resp.statusCode !== 200) { resp.resume(); return res(null); }
        var body = '';
        resp.setEncoding('utf8');
        resp.on('data', function(chunk) {
          body += chunk;
          if (body.length > 200000) { resp.destroy(); }
        });
        resp.on('end', function() { res(body); });
        resp.on('error', function() { res(null); });
      });
      req.on('timeout', function() { req.destroy(); res(null); });
      req.on('error', function() { res(null); });
    } catch(e) {
      res(null);
    }
  });
}

function extractSocials(html) {
  var result = {};
  if (!html) return result;
  var re = /href=["']([^"']{10,200})["']/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var h = m[1];
    var l = h.toLowerCase();
    try {
      if (!result.facebookUrl && l.indexOf('facebook.com/') !== -1 &&
          l.indexOf('sharer') === -1 && l.indexOf('dialog') === -1 &&
          l.indexOf('plugins') === -1 && l.indexOf('/tr?') === -1) {
        var fu = new URL(h.startsWith('http') ? h : 'https://facebook.com' + h);
        if (fu.pathname && fu.pathname.length > 1 && fu.pathname !== '/') {
          result.facebookUrl = 'https://www.facebook.com' + fu.pathname.replace(/\/$/, '');
        }
      }
      if (!result.instagramUrl && l.indexOf('instagram.com/') !== -1 &&
          l.indexOf('/p/') === -1 && l.indexOf('share') === -1) {
        var iu = new URL(h.startsWith('http') ? h : 'https://instagram.com' + h);
        if (iu.pathname && iu.pathname.length > 1 && iu.pathname !== '/') {
          result.instagramUrl = 'https://www.instagram.com' + iu.pathname.replace(/\/$/, '');
        }
      }
      if (!result.twitterUrl && (l.indexOf('twitter.com/') !== -1 || l.indexOf('x.com/') !== -1) &&
          l.indexOf('share') === -1 && l.indexOf('intent') === -1) {
        result.twitterUrl = h.split('?')[0];
      }
      if (!result.youtubeUrl && l.indexOf('youtube.com/') !== -1 &&
          l.indexOf('/watch') === -1 && l.indexOf('embed') === -1) {
        result.youtubeUrl = h.split('?')[0];
      }
      if (!result.tiktokUrl && l.indexOf('tiktok.com/@') !== -1) {
        result.tiktokUrl = h.split('?')[0];
      }
    } catch(e) {}
  }
  return result;
}

function sleep(ms) {
  return new Promise(function(r) { setTimeout(r, ms); });
}

async function run() {
  fs.writeFileSync(LOG, '');
  log('Scraper v3 starting — batch mode');

  var BATCH = 50;
  var cursor = null;
  var done = 0, updated = 0, skipped = 0, failed = 0;
  var total = await p.campground.count({ where: { websiteUrl: { not: null } } });
  log('Total to process: ' + total);

  while (true) {
    // Fetch next batch
    var query = {
      where: { websiteUrl: { not: null } },
      select: { id: true, name: true, websiteUrl: true, facebookUrl: true, instagramUrl: true, twitterUrl: true, youtubeUrl: true, tiktokUrl: true },
      orderBy: { id: 'asc' },
      take: BATCH,
    };
    if (cursor) {
      query.skip = 1;
      query.cursor = { id: cursor };
    }

    var batch = await p.campground.findMany(query);
    if (!batch || batch.length === 0) break;
    cursor = batch[batch.length - 1].id;

    for (var i = 0; i < batch.length; i++) {
      var cg = batch[i];
      done++;

      if (cg.facebookUrl && cg.instagramUrl) {
        skipped++;
        continue;
      }

      var url = cg.websiteUrl;
      if (!url.startsWith('http')) url = 'https://' + url;

      var html = null;
      try { html = await fetchPage(url); } catch(e) { html = null; }

      if (!html) {
        failed++;
      } else {
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
      }

      await sleep(1200);
    }

    log('Progress: ' + done + '/' + total + ' | updated:' + updated + ' skipped:' + skipped + ' failed:' + failed);

    if (batch.length < BATCH) break;
  }

  log('DONE. Updated:' + updated + ' Skipped:' + skipped + ' Failed:' + failed);
  await p.$disconnect();
}

run().catch(function(e) {
  log('FATAL: ' + e.message + '\n' + e.stack);
  process.exit(1);
});
