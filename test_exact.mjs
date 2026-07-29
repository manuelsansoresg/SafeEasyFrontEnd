import { chromium } from 'playwright';

(async () => {
  // Contexto NUEVO (como incógnito)
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
  console.log(`URL después de login: ${page.url()}`);

  // Ir a /admin/users
  await page.goto('http://localhost:3000/admin/users/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log(`URL: ${page.url()}`);

  // ANTES de marcar toggle
  const beforeRows = await page.locator('tbody tr').count();
  console.log(`\n=== ANTES del toggle ===`);
  console.log(`Filas: ${beforeRows}`);
  
  // Capturar el HTML de la primera fila para ver qué tiene
  const firstRowHTML = await page.locator('tbody tr').first().innerHTML();
  console.log(`HTML primera fila (200 chars): ${firstRowHTML.substring(0, 200)}`);

  // Marcar toggle
  const label = page.locator('label:has-text("Mostrar eliminados")');
  const checkbox = label.locator('input[type="checkbox"]');
  console.log(`\n=== Toggle: marcando... ===`);
  await checkbox.check();
  await page.waitForTimeout(3000);
  console.log(`Marcado: ${await checkbox.isChecked()}`);

  // DESPUÉS de marcar toggle
  const afterRows = await page.locator('tbody tr').count();
  console.log(`\n=== DESPUÉS del toggle ===`);
  console.log(`Filas: ${afterRows}`);
  
  // Verificar el HTML de TODAS las filas
  console.log(`\n=== HTML de las filas ===`);
  for (let i = 0; i < Math.min(afterRows, 5); i++) {
    const rowHTML = await page.locator('tbody tr').nth(i).innerHTML();
    const hasEliminado = rowHTML.includes('Eliminado');
    const hasRestaurar = rowHTML.includes('Restaurar');
    const hasDeleted = rowHTML.includes('bg-red-50');
    console.log(`Fila ${i}: Eliminado=${hasEliminado}, Restaurar=${hasRestaurar}, bg-red=${hasDeleted}`);
  }
  
  // Screenshot
  await page.screenshot({ path: '/tmp/exact_test.png', fullPage: true });
  console.log('\nScreenshot: /tmp/exact_test.png');

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
