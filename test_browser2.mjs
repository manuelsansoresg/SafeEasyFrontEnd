import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('request', req => {
    if (req.url().includes('/api/users')) {
      console.log(`REQUEST: ${req.method()} ${req.url()}`);
    }
  });
  page.on('response', async res => {
    if (res.url().includes('/api/users') && !res.url().includes('me')) {
      try {
        const data = await res.json();
        console.log(`RESPONSE: ${res.status()} ${res.url()} - Total: ${Array.isArray(data) ? data.length : 'N/A'}`);
      } catch {}
    }
  });

  // Login directo
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', 'gem_88@hotmail.com');
  await page.fill('input[type="password"]', 'odin8502');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  console.log(`URL después de login: ${page.url()}`);

  // Ir a /admin/users
  console.log('=== Navegando a /admin/users ===');
  await page.goto('http://localhost:3000/admin/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log(`URL: ${page.url()}`);
  
  // Verificar que el toggle existe
  const toggle = page.locator('text="Mostrar eliminados"');
  console.log(`Toggle visible: ${await toggle.count() > 0}`);

  // Marcar el toggle
  console.log('=== Marcando el toggle ===');
  const checkboxes = page.locator('input[type="checkbox"]');
  console.log(`Checkboxes en la página: ${await checkboxes.count()}`);
  
  // Buscar el checkbox del toggle (es uno específico)
  const toggleCheckbox = page.locator('input[type="checkbox"]').filter({ hasNot: page.locator('text="Mostrar eliminados"') }).first();
  // Mejor buscar por el label
  const label = page.locator('label:has-text("Mostrar eliminados")');
  const checkbox = label.locator('input[type="checkbox"]');
  console.log(`Checkbox del toggle: ${await checkbox.count()}`);
  
  if (await checkbox.count() > 0) {
    const isChecked = await checkbox.isChecked();
    console.log(`Estado inicial: ${isChecked ? 'marcado' : 'desmarcado'}`);
    await checkbox.check();
    await page.waitForTimeout(3000);
    console.log(`Después de check: ${await checkbox.isChecked() ? 'marcado' : 'desmarcado'}`);
  }

  // Verificar el contenido de la página
  const rowCount = await page.locator('tbody tr').count();
  console.log(`Filas en la tabla: ${rowCount}`);
  const eliminadoBadges = await page.locator('text="Eliminado"').count();
  console.log(`Badges "Eliminado": ${eliminadoBadges}`);

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
