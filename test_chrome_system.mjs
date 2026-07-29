import { chromium } from 'playwright';

(async () => {
  // Usar Chrome del sistema (igual al de Manuel)
  const browser = await chromium.launch({ 
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const loginForm = page.locator('form').filter({ has: page.locator('input[type="email"]') });
  await loginForm.locator('input[type="email"]').fill('gem_88@hotmail.com');
  await loginForm.locator('input[type="password"]').fill('odin8502');
  await loginForm.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);

  // Verificar y matar Service Workers
  const swInfo = await page.evaluate(async () => {
    if (!navigator.serviceWorker) return 'No serviceWorker API';
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length === 0) return 'No service workers registered';
    const info = [];
    for (const r of regs) {
      info.push({ scope: r.scope, active: !!r.active });
      try { await r.unregister(); } catch(e) {}
    }
    return info;
  });
  console.log('Service Workers:', JSON.stringify(swInfo));

  // Verificar caches
  const cacheInfo = await page.evaluate(async () => {
    if (!window.caches) return 'No caches API';
    const keys = await caches.keys();
    return keys;
  });
  console.log('Cache keys:', JSON.stringify(cacheInfo));

  // Ir a /admin/users
  await page.goto('http://localhost:3000/admin/users/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Marcar toggle
  const label = page.locator('label:has-text("Mostrar eliminados")');
  const checkbox = label.locator('input[type="checkbox"]');
  await checkbox.check();
  await page.waitForTimeout(3000);

  // Verificar filas con badge
  const rows = await page.locator('tbody tr').all();
  let conEliminado = 0;
  let conRestaurar = 0;
  
  for (const row of rows) {
    const html = await row.innerHTML();
    if (html.includes('Eliminado')) conEliminado++;
    if (html.includes('Restaurar')) conRestaurar++;
  }
  
  console.log(`\n=== RESULTADO FINAL ===`);
  console.log(`Total filas: ${rows.length}`);
  console.log(`Filas con badge "Eliminado": ${conEliminado}`);
  console.log(`Filas con botón "Restaurar": ${conRestaurar}`);

  // Screenshot final
  await page.screenshot({ path: '/tmp/resultado_final.png', fullPage: true });
  console.log('Screenshot: /tmp/resultado_final.png');

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
