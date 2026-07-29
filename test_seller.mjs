import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const loginForm = page.locator('form').filter({ has: page.locator('input[type="email"]') });
  await loginForm.locator('input[type="email"]').fill('gem_88@hotmail.com');
  await loginForm.locator('input[type="password"]').fill('odin8502');
  await loginForm.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);

  // /admin/sellers (que SÍ tiene un seller eliminado)
  console.log('=== /admin/sellers ===');
  await page.goto('http://localhost:3000/admin/sellers/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  const label = page.locator('label:has-text("Mostrar eliminados")');
  const checkbox = label.locator('input[type="checkbox"]');
  await checkbox.check();
  await page.waitForTimeout(3000);

  const rows = await page.locator('tbody tr').all();
  let conRestaurar = 0;
  let conEliminado = 0;
  for (const row of rows) {
    const html = await row.innerHTML();
    if (html.includes('Restaurar')) conRestaurar++;
    if (html.includes('Eliminado')) conEliminado++;
  }
  console.log(`Total filas: ${rows.length}, Con Eliminado: ${conEliminado}, Con Restaurar: ${conRestaurar}`);

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
