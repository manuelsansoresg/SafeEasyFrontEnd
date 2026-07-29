import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('request', req => {
    if (req.url().includes('/api/users')) {
      console.log(`REQ: ${req.method()} ${req.url()}`);
    }
  });

  // Login
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', 'gem_88@hotmail.com');
  await page.fill('input[type="password"]', 'odin8502');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Ir a /admin/users
  console.log('=== Navegando a /admin/users ===');
  await page.goto('http://localhost:3000/admin/users/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Imprimir todos los tbody tr
  const rows = await page.locator('tbody tr').all();
  console.log(`\n=== Filas en tbody: ${rows.length} ===`);
  for (let i = 0; i < rows.length; i++) {
    const text = await rows[i].innerText();
    console.log(`Fila ${i}: ${text.substring(0, 200)}`);
  }

  // Ver el HTML del tbody
  const tbodyHTML = await page.locator('tbody').innerHTML();
  console.log(`\n=== HTML del tbody (primeros 500 chars) ===`);
  console.log(tbodyHTML.substring(0, 500));

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
