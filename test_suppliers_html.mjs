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

  await page.goto('http://localhost:3000/admin/suppliers/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const label = page.locator('label:has-text("Mostrar eliminados")');
  const checkbox = label.locator('input[type="checkbox"]');
  await checkbox.check();
  await page.waitForTimeout(3000);

  // Ver el HTML de la ÚLTIMA fila (que probablemente es el supplier eliminado)
  const allRows = await page.locator('tbody tr').all();
  console.log(`Total filas: ${allRows.length}`);
  
  if (allRows.length > 0) {
    const lastRow = allRows[allRows.length - 1];
    const html = await lastRow.innerHTML();
    console.log(`\n=== Última fila (length: ${html.length}) ===`);
    console.log(html.substring(0, 3000));
  }

  // Screenshot
  await page.screenshot({ path: '/tmp/suppliers_html.png', fullPage: true });
  
  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
