import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const loginForm = page.locator('form').filter({ has: page.locator('input[type="email"]') });
  await loginForm.locator('input[type="email"]').fill('gem_88@hotmail.com');
  await loginForm.locator('input[type="password"]').fill('odin8502');
  await loginForm.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);

  // IR A /admin/suppliers/ (la URL exacta de Manuel)
  console.log('=== Navegando a /admin/suppliers/ ===');
  await page.goto('http://localhost:3000/admin/suppliers/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Capturar todos los requests
  const apiReqs = [];
  page.on('request', req => {
    if (req.url().includes('/api/')) apiReqs.push(req.url());
  });

  const label = page.locator('label:has-text("Mostrar eliminados")');
  const cbCount = await label.count();
  console.log(`Toggle "Mostrar eliminados" existe: ${cbCount > 0 ? 'SÍ' : 'NO'}`);
  
  if (cbCount > 0) {
    const checkbox = label.locator('input[type="checkbox"]');
    console.log(`Checkbox inicial: ${await checkbox.isChecked() ? 'marcado' : 'desmarcado'}`);
    
    await checkbox.check();
    await page.waitForTimeout(3000);
    console.log(`Checkbox final: ${await checkbox.isChecked() ? 'marcado' : 'desmarcado'}`);
  }
  
  // Ver las filas
  const rows = await page.locator('tbody tr, [class*="divide-y"] > div, article').all();
  console.log(`\nTotal filas: ${rows.length}`);
  
  let conEliminado = 0;
  let conRestaurar = 0;
  for (const row of rows) {
    const html = await row.innerHTML();
    if (html.includes('Eliminado')) conEliminado++;
    if (html.includes('Restaurar')) conRestaurar++;
  }
  console.log(`Filas con "Eliminado": ${conEliminado}`);
  console.log(`Filas con "Restaurar": ${conRestaurar}`);
  
  // Ver TODAS las requests
  console.log(`\n=== Requests API ===`);
  apiReqs.filter(u => u.includes('supplier') || u.includes('users')).forEach(u => console.log(`  ${u}`));
  
  // Screenshot
  await page.screenshot({ path: '/tmp/suppliers_test.png', fullPage: true });
  console.log('\nScreenshot: /tmp/suppliers_test.png');

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
