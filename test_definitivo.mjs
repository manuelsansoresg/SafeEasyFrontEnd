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
  await page.waitForTimeout(2000);
  
  const label = page.locator('label:has-text("Mostrar eliminados")');
  const checkbox = label.locator('input[type="checkbox"]');
  await checkbox.check();
  await page.waitForTimeout(3000);

  // Buscar el supplier 111 (que está soft-deleted)
  const supplier = await page.evaluate(async () => {
    const tokenRaw = window.localStorage.getItem('auth-storage');
    const parsed = JSON.parse(tokenRaw);
    const token = parsed.state.token;
    
    const resp = await fetch('/api/suppliers/?skip=0&limit=1000&include_deleted=true', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await resp.json();
    const deleted = data.filter(s => s.user_deleted_at);
    return { total: data.length, deleted: deleted.length, deletedList: deleted.map(s => ({ id: s.id, name: s.name, user_id: s.user_id, user_deleted_at: s.user_deleted_at })) };
  });
  
  console.log('=== Suppliers eliminados en la BD ===');
  console.log(JSON.stringify(supplier, null, 2));

  // Ver el HTML de las filas
  const rows = await page.locator('tbody tr').all();
  console.log(`\n=== Filas en la página: ${rows.length} ===`);
  
  // Buscar específicamente filas que tengan el nombre "Proveedor Demo Eliminado"
  for (let i = 0; i < rows.length; i++) {
    const text = await rows[i].innerText();
    if (text.includes('Proveedor Demo') || text.includes('proveedor_elim')) {
      console.log(`\n=== Fila ${i} CONTIENE "Proveedor Demo" ===`);
      const html = await rows[i].innerHTML();
      console.log(html.substring(0, 2000));
    }
  }
  
  // Si no encuentra, ver la última fila
  if (rows.length > 0) {
    console.log(`\n=== Última fila (primeros 1500 chars) ===`);
    const lastRow = rows[rows.length - 1];
    const html = await lastRow.innerHTML();
    console.log(html.substring(0, 1500));
  }

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
