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

  // Ir a /admin/users con include_deleted
  await page.goto('http://localhost:3000/admin/users/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Marcar toggle
  const label = page.locator('label:has-text("Mostrar eliminados")');
  const checkbox = label.locator('input[type="checkbox"]');
  await checkbox.check();
  await page.waitForTimeout(3000);

  // Ver el HTML de la primera fila
  const firstRowHTML = await page.locator('tbody tr').first().innerHTML();
  console.log('=== Primera fila HTML (primeros 800 chars) ===');
  console.log(firstRowHTML.substring(0, 800));
  
  // Ver si hay algún badge con la palabra "Eliminado" en el HTML
  const allHTML = await page.locator('table').innerHTML();
  const tieneEliminado = allHTML.includes('Eliminado');
  console.log(`\n"Eliminado" en el HTML: ${tieneEliminado}`);
  
  // Buscar cualquier elemento que tenga "Eliminado"
  const eliminadoCount = await page.locator('text=/Eliminado/').count();
  console.log(`Elementos con "Eliminado": ${eliminadoCount}`);
  
  // Buscar "Restaurar"
  const restaurarCount = await page.locator('text=/Restaurar/').count();
  console.log(`Elementos con "Restaurar": ${restaurarCount}`);

  // Screenshot
  await page.screenshot({ path: '/tmp/users_with_toggle.png', fullPage: true });
  console.log('Screenshot guardado');

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
