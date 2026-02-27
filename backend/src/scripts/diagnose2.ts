import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({ headless: false, defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  // Load app
  await page.goto('https://forestriverinc.help/#/coachmenrv/vehicles/2025', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  // Navigate to travel_trailer category
  await page.evaluate(() => { window.location.hash = '/coachmenrv/guide/2025/3558-freedom-express/browse'; });
  await new Promise(r => setTimeout(r, 4000));

  const dump = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a')).map(a => ({
      text: (a.textContent || '').trim().slice(0, 80),
      href: (a as HTMLAnchorElement).href?.slice(0, 120),
    })).filter(l => l.text);

    return {
      hash: window.location.hash,
      linkCount: links.length,
      links,
      body: document.body.innerText.slice(0, 2000),
    };
  });

  console.log('Hash:', dump.hash);
  console.log('All links:');
  dump.links.forEach(l => console.log(`  [${l.text}] → ${l.href}`));
  console.log('\nBody text:\n', dump.body);

  await new Promise(r => setTimeout(r, 20000));
  await browser.close();
}

main().catch(console.error);
