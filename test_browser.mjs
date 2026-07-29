import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capturar todos los requests y responses
  const requests = [];
  const responses = [];
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      requests.push({ method: req.method(), url: req.url() });
    }
  });
  page.on('response', res => {
    if (res.url().includes('/api/')) {
      responses.push({ status: res.status(), url: res.url() });
    }
  });
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });

  // Login
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('input[type="email"]', { timeout: 5000 });
  await page.fill('input[type="email"]', 'gem_88@hotmail.com');
  await page.fill('input[type="password"]', 'odin8502');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin/**', { timeout: 10000 }).catch(() => {});
  
  // Ir a /admin/users
  console.log('=== Navegando a /admin/users ===');
  await page.goto('http://localhost:3000/admin/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Screenshot del estado inicial
  await page.screenshot({ path: '/tmp/browser_initial.png' });
  console.log('Screenshot guardado: /tmp/browser_initial.png');

  // Capturar el HTML del toggle
  const toggleExists = await page.locator('text="Mostrar eliminados"').count();
  console.log(`Toggle "Mostrar eliminados" visible: ${toggleExists > 0 ? 'SÍ' : 'NO'}`);

  // Marcar el toggle
  if (toggleExists > 0) {
    console.log('=== Marcando el toggle ===');
    await page.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(3000);
    
    // Screenshot después del toggle
    await page.screenshot({ path: '/tmp/browser_after_toggle.png' });
    console.log('Screenshot guardado: /tmp/browser_after_toggle.png');
    
    // Verificar si hay badges "Eliminado"
    const eliminadoBadges = await page.locator('text="Eliminado"').count();
    console.log(`Badges "Eliminado" visibles: ${eliminadoBadges}`);
    
    // Verificar si hay botones "Restaurar"
    const restaurarBtns = await page.locator('text="Restaurar"').count();
    console.log(`Botones "Restaurar" visibles: ${restaurarBtns}`);
    
    // Verificar el número de filas
    const rowCount = await page.locator('tbody tr').count();
    console.log(`Filas en la tabla: ${rowCount}`);
  }
  
  // Imprimir requests
  console.log('\n=== Requests API hechos ===');
  requests.forEach(r => console.log(`  ${r.method} ${r.url}`));
  console.log('\n=== Responses API ===');
  responses.forEach(r => console.log(`  ${r.status} ${r.url}`));
  
  await browser.close();
})().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
