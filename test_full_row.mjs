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

  await page.goto('http://localhost:3000/admin/users/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  const label = page.locator('label:has-text("Mostrar eliminados")');
  const checkbox = label.locator('input[type="checkbox"]');
  await checkbox.check();
  await page.waitForTimeout(3000);
  
  // Verificar las filas que tienen bg-red
  const allRows = await page.locator('tbody tr').all();
  console.log(`Total filas: ${allRows.length}`);
  
  for (let i = 0; i < allRows.length; i++) {
    const html = await allRows[i].innerHTML();
    const hasBgRed = html.includes('bg-red-50');
    if (hasBgRed) {
      // Extraer el email
      const emailMatch = html.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]+)/);
      console.log(`\nFila ${i} (bg-red): ${emailMatch ? emailMatch[0] : 'N/A'}`);
      // Buscar el badge Eliminado
      const hasEliminadoBadge = html.includes('bg-red-50 text-red-700');
      console.log(`  Tiene badge Eliminado: ${hasEliminadoBadge}`);
      // Buscar el botón Restaurar
      const hasRestaurarBtn = html.includes('Restaurar');
      console.log(`  Tiene botón Restaurar: ${hasRestaurarBtn}`);
      // Ver el innerText
      const text = await allRows[i].innerText();
      console.log(`  Texto: ${text.substring(0, 300)}`);
    }
  }

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
