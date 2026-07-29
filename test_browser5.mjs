import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capturar TODO
  page.on('request', req => {
    if (req.url().includes('localhost:3000') && req.url().includes('/api/')) {
      console.log(`REQ: ${req.method()} ${req.url()}`);
    }
  });
  page.on('response', res => {
    if (res.url().includes('localhost:3000') && res.url().includes('/api/')) {
      console.log(`RES: ${res.status()} ${res.url()}`);
    }
  });
  page.on('pageerror', err => console.log(`PAGE ERROR: ${err.message}`));

  // Login
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', 'gem_88@hotmail.com');
  await page.fill('input[type="password"]', 'odin8502');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  console.log('=== Después de login ===');

  // Ir a /admin/users
  await page.goto('http://localhost:3000/admin/users/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log('=== Después de navegar a /admin/users ===');

  // Marcar el toggle
  console.log('=== Marcando toggle ===');
  const label = page.locator('label:has-text("Mostrar eliminados")');
  const checkbox = label.locator('input[type="checkbox"]');
  await checkbox.check();
  await page.waitForTimeout(3000);
  console.log('=== Después de toggle ===');

  // Verificar filas y badges
  const rowCount = await page.locator('tbody tr').count();
  console.log(`\nFilas: ${rowCount}`);
  const firstRowText = await page.locator('tbody tr').first().innerText().catch(() => 'N/A');
  console.log(`Primera fila: ${firstRowText.substring(0, 200)}`);
  
  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
