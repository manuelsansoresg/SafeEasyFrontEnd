import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', res => {
    if (res.url().includes('/api/login')) {
      console.log(`LOGIN RES: ${res.status()} ${res.url()}`);
    }
  });
  page.on('pageerror', err => console.log(`PAGE ERROR: ${err.message}`));

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', 'gem_88@hotmail.com');
  await page.fill('input[type="password"]', 'odin8502');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  console.log(`URL después de login: ${page.url()}`);
  
  // Ver el localStorage
  const ls = await page.evaluate(() => {
    const items = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      items[key] = localStorage.getItem(key)?.substring(0, 100);
    }
    return items;
  });
  console.log('localStorage:', JSON.stringify(ls, null, 2));
  
  // Ver el HTML
  const h1 = await page.locator('h1').first().textContent().catch(() => 'N/A');
  console.log(`H1 en la página: ${h1}`);

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
