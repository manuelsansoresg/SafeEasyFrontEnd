import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`CONSOLE ${msg.type()}: ${msg.text()}`);
  });
  page.on('response', res => {
    if (res.url().includes('/api/')) {
      console.log(`RES: ${res.status()} ${res.url().replace('http://localhost:3000', '')}`);
    }
  });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', 'gem_88@hotmail.com');
  await page.fill('input[type="password"]', 'odin8502');
  console.log('=== Submit ===');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  console.log(`\n=== URL final: ${page.url()} ===`);
  
  // Ver TODO el localStorage
  const ls = await page.evaluate(() => {
    const items = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      items[key] = localStorage.getItem(key);
    }
    return items;
  });
  console.log('=== localStorage ===');
  for (const [k, v] of Object.entries(ls)) {
    console.log(`  ${k}: ${v?.substring(0, 200)}`);
  }

  // Ver sessionStorage también
  const ss = await page.evaluate(() => {
    const items = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      items[key] = sessionStorage.getItem(key);
    }
    return items;
  });
  console.log('=== sessionStorage ===');
  for (const [k, v] of Object.entries(ss)) {
    console.log(`  ${k}: ${v?.substring(0, 200)}`);
  }

  // Ver el texto de la página
  const bodyText = await page.locator('body').textContent();
  console.log(`\n=== Texto de la página (primeros 300 chars) ===`);
  console.log(bodyText.substring(0, 300));

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
