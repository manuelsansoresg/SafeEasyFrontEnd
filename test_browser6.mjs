import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('request', req => {
    if (req.url().includes('/api/users') && !req.url().includes('me')) {
      console.log(`REQ: ${req.method()} ${req.url()}`);
    }
  });

  // Login
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', 'gem_88@hotmail.com');
  await page.fill('input[type="password"]', 'odin8502');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Verificar el token en localStorage
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('auth-storage');
    if (!raw) return 'NO AUTH STORAGE';
    const parsed = JSON.parse(raw);
    return parsed.state?.token?.substring(0, 30) || 'NO TOKEN';
  });
  console.log(`Token en localStorage: ${token}`);

  // Ir a /admin/users
  console.log('=== Navegando a /admin/users/ ===');
  await page.goto('http://localhost:3000/admin/users/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  // Verificar el token después de la navegación
  const token2 = await page.evaluate(() => {
    const raw = window.localStorage.getItem('auth-storage');
    if (!raw) return 'NO AUTH STORAGE';
    const parsed = JSON.parse(raw);
    return parsed.state?.token?.substring(0, 30) || 'NO TOKEN';
  });
  console.log(`Token en localStorage después: ${token2}`);

  // Verificar que el componente esté renderizado
  const toggleText = await page.locator('text="Mostrar eliminados"').count();
  console.log(`Toggle visible: ${toggleText > 0 ? 'SÍ' : 'NO'}`);

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
