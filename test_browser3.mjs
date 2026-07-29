import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const allRequests = [];
  page.on('request', req => {
    allRequests.push({ method: req.method(), url: req.url() });
  });
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`CONSOLE ${msg.type()}: ${msg.text()}`);
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
  await page.goto('http://localhost:3000/admin/users/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  console.log(`URL: ${page.url()}`);

  // Esperar a que la tabla tenga datos
  await page.waitForTimeout(3000);
  const rowCount = await page.locator('tbody tr').count();
  console.log(`Filas antes del toggle: ${rowCount}`);

  // Limpiar requests
  allRequests.length = 0;

  // Marcar el toggle
  console.log('=== Marcando el toggle ===');
  const label = page.locator('label:has-text("Mostrar eliminados")');
  const checkbox = label.locator('input[type="checkbox"]');
  await checkbox.check();
  await page.waitForTimeout(5000);

  console.log(`\n=== TODOS los requests después del toggle ===`);
  allRequests.filter(r => r.url.includes('localhost')).forEach(r => {
    console.log(`  ${r.method} ${r.url}`);
  });

  // Verificar filas
  const rowCountAfter = await page.locator('tbody tr').count();
  console.log(`\nFilas después del toggle: ${rowCountAfter}`);
  const eliminadoBadges = await page.locator('text="Eliminado"').count();
  console.log(`Badges "Eliminado": ${eliminadoBadges}`);
  const restaurarBtns = await page.locator('text="Restaurar"').count();
  console.log(`Botones "Restaurar": ${restaurarBtns}`);

  // Screenshot
  await page.screenshot({ path: '/tmp/browser_final.png', fullPage: true });
  console.log('Screenshot final guardado');

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
