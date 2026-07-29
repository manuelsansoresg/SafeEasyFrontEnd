import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`CONSOLE ${msg.type()}: ${msg.text().substring(0, 200)}`);
  });
  page.on('response', res => {
    if (res.url().includes('/api/login') || res.url().includes('/api/users/me')) {
      console.log(`RES: ${res.status()} ${res.url().replace('http://localhost:3000', '')}`);
    }
  });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Ver el HTML del form
  const formHTML = await page.locator('form').first().innerHTML();
  console.log('=== FORM HTML ===');
  console.log(formHTML.substring(0, 500));
  
  await page.fill('input[type="email"]', 'gem_88@hotmail.com');
  await page.fill('input[type="password"]', 'odin8502');
  await page.waitForTimeout(500);
  
  console.log('\n=== Submit ===');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(5000);
  
  console.log(`\nURL final: ${page.url()}`);

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
