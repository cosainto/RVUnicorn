const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer');
const cloudinary = require('cloudinary').v2;

const prisma = new PrismaClient();
const delay = (ms) => new Promise(r => setTimeout(r, ms));

cloudinary.config({
  cloud_name: 'dy6eetmh7',
  api_key: '333927774328418',
  api_secret: '9phbOjjX2YxVI43orwmWdoiCvew'
});

const SKIP = [/sitemap/i, /firedanger/i, /recreation\.gov/i, /login/i, /signin/i];

async function shot(browser, url, id) {
  var page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    var buf = await page.screenshot({ type: 'png', fullPage: false });
    var r = await new Promise(function(ok, no) {
      var s = cloudinary.uploader.upload_stream(
        { folder: 'rvunicorn/campground-maps', public_id: id, resource_type: 'image', overwrite: true, format: 'png' },
        function(e, r) { if (e) no(e); else ok(r); }
      );
      s.end(buf);
    });
    return r.secure_url;
  } catch (e) {
    console.log('  Err:', e.message);
    return null;
  } finally {
    if (page) try { await page.close(); } catch(x){}
  }
}

async function main() {
  var args = process.argv.slice(2);
  var la = args.find(function(a) { return a.startsWith('--limit='); });
  var limit = la ? parseInt(la.split('=')[1]) : 9999;
  var dry = args.includes('--dry-run');

  console.log('CONVERT EXTERNAL MAPS TO CLOUDINARY IMAGES');
  console.log('==========================================');
  if (dry) console.log('DRY RUN\n');

  var all = await prisma.campground.findMany({
    where: { campgroundMapUrl: { not: null } },
    select: { id: true, name: true, campgroundMapUrl: true },
    take: limit,
    orderBy: { name: 'asc' }
  });

  var valid = all.filter(function(c) {
    if (!c.campgroundMapUrl) return false;
    if (c.campgroundMapUrl.includes('cloudinary')) return false;
    if (SKIP.some(function(p) { return p.test(c.campgroundMapUrl); })) return false;
    return true;
  });

  console.log('Skipped ' + (all.length - valid.length) + ', processing ' + valid.length + '\n');

  if (dry) {
    valid.slice(0, 20).forEach(function(c, i) {
      console.log((i + 1) + '. ' + c.name);
      console.log('   ' + c.campgroundMapUrl + '\n');
    });
    await prisma.$disconnect();
    return;
  }

  var browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  var ok = 0;
  var fail = 0;

  for (var i = 0; i < valid.length; i++) {
    var c = valid[i];
    process.stdout.write('[' + (i + 1) + '/' + valid.length + '] ' + c.name + '... ');

    var url = await shot(browser, c.campgroundMapUrl, c.id);

    if (url) {
      await prisma.campground.update({ where: { id: c.id }, data: { campgroundMapUrl: url } });
      ok++;
      console.log('OK');
    } else {
      await prisma.campground.update({ where: { id: c.id }, data: { campgroundMapUrl: null } });
      fail++;
      console.log('FAIL - cleared');
    }

    if (i % 5 === 0 && i > 0) await delay(1000);
    if ((i + 1) % 50 === 0) {
      console.log('\n--- Progress: ' + (i + 1) + '/' + valid.length + ' | OK: ' + ok + ' | FAIL: ' + fail + ' ---\n');
    }
  }

  await browser.close();
  console.log('\nDone! Converted: ' + ok + ' | Failed: ' + fail);
  var total = await prisma.campground.count({ where: { campgroundMapUrl: { not: null } } });
  console.log('Total campgrounds with maps: ' + total);
  await prisma.$disconnect();
}

main().catch(function(e) { console.error(e); process.exit(1); });
