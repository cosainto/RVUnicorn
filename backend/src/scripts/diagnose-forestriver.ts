/**
 * Diagnostic — dumps what's actually on forestriverinc.help after navigation
 * Run: npx tsx src/scripts/diagnose-forestriver.ts
 */
import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  console.log('Loading app...');
  await page.goto('https://forestriverinc.help/#/coachmenrv/vehicles/2025', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  // Wait extra time for React to render
  await new Promise(r => setTimeout(r, 5000));

  const dump = await page.evaluate(() => {
    // Get all links
    const allLinks = Array.from(document.querySelectorAll('a')).map(a => ({
      text: (a.textContent || '').trim().slice(0, 60),
      href: (a as HTMLAnchorElement).href?.slice(0, 100),
    })).filter(l => l.text || l.href);

    // Get all text content (first 3000 chars)
    const bodyText = document.body.innerText.slice(0, 3000);

    // Get all elements with click handlers or role=button
    const clickables = Array.from(document.querySelectorAll('[role="button"], button, [onclick]')).map(el => ({
      tag: el.tagName,
      text: (el.textContent || '').trim().slice(0, 60),
      class: el.className.slice(0, 60),
    }));

    // Page title and URL
    return {
      title: document.title,
      url: window.location.href,
      hash: window.location.hash,
      linkCount: allLinks.length,
      links: allLinks.slice(0, 30),
      bodyText,
      clickables: clickables.slice(0, 20),
    };
  });

  console.log('\n=== PAGE INFO ===');
  console.log('Title:', dump.title);
  console.log('URL:', dump.url);
  console.log('Hash:', dump.hash);
  console.log('\n=== ALL LINKS (' + dump.linkCount + ' total, showing first 30) ===');
  dump.links.forEach(l => console.log(`  [${l.text}] → ${l.href}`));
  console.log('\n=== CLICKABLE ELEMENTS ===');
  dump.clickables.forEach(c => console.log(`  <${c.tag}> "${c.text}" class="${c.class}"`));
  console.log('\n=== BODY TEXT (first 2000 chars) ===');
  console.log(dump.bodyText.slice(0, 2000));

  // Now try navigating via hash change and dump again
  console.log('\n\n=== AFTER HASH CHANGE to 2024 ===');
  await page.evaluate(() => { window.location.hash = '/coachmenrv/vehicles/2024'; });
  await new Promise(r => setTimeout(r, 4000));

  const dump2 = await page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll('a')).map(a => ({
      text: (a.textContent || '').trim().slice(0, 60),
      href: (a as HTMLAnchorElement).href?.slice(0, 100),
    })).filter(l => l.text);
    return {
      hash: window.location.hash,
      linkCount: allLinks.length,
      links: allLinks.slice(0, 30),
      bodyText: document.body.innerText.slice(0, 1000),
    };
  });

  console.log('Hash:', dump2.hash);
  console.log('Links:', dump2.linkCount);
  dump2.links.forEach(l => console.log(`  [${l.text}] → ${l.href}`));
  console.log('\nBody:', dump2.bodyText);

  console.log('\n\nPress Ctrl+C to close browser...');
  await new Promise(r => setTimeout(r, 30000));
  await browser.close();
}

main().catch(console.error);
