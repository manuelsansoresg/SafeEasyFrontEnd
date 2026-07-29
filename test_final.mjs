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

  await page.goto('http://localhost:3000/admin/users/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  const label = page.locator('label:has-text("Mostrar eliminados")');
  const checkbox = label.locator('input[type="checkbox"]');
  await checkbox.check();
  await page.waitForTimeout(3000);
  
  // Verificar el HTML completo
  const tbodyHTML = await page.locator('tbody').innerHTML();
  
  // Buscar cuántas filas tienen el badge Eliminado
  const rows = await page.locator('tbody tr').all();
  let rowsWithBadge = 0;
  let rowsWithRestaurar = 0;
  let rowsWithBgRed = 0;
  
  console.log(`Total filas: ${rows.length}`);
  
  for (let i = 0; i < rows.length; i++) {
    const html = await rows[i].innerHTML();
    if (html.includes('Eliminado')) rowsWithBadge++;
    if (html.includes('Restaurar')) rowsWithRestaurar++;
    if (html.includes('bg-red-50/30') || html.includes('bg-red-50"')) rowsWithBgRed++;
  }
  
  console.log(`Filas con "Eliminado": ${rowsWithBadge}`);
  console.log(`Filas con "Restaurar": ${rowsWithRestaurar}`);
  console.log(`Filas con bg-red: ${rowsWithBgRed}`);
  
  // Ver la primera fila que tenga "Eliminado" (si hay alguna)
  for (let i = 0; i < rows.length; i++) {
    const html = await rows[i].innerHTML();
    if (html.includes('Eliminado')) {
      console.log(`\n=== Fila ${i} CON Eliminado ===`);
      console.log(html.substring(0, 1500));
      break;
    }
  }
  
  // Si no hay filas con Eliminado, ver la primera fila
  if (rowsWithBadge === 0) {
    console.log(`\n=== Primera fila (sin Eliminado) ===`);
    const firstHTML = await rows[0].innerHTML();
    console.log(firstHTML.substring(0, 2000));
  }

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
