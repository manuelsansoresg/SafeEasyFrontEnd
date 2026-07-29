import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    const t = msg.text();
    if (t.includes('Login') || t.includes('login') || t.includes('auth') || t.includes('API') || t.includes('users') || t.includes('me')) {
      console.log(`CONSOLE: ${t.substring(0, 200)}`);
    }
  });
  page.on('response', res => {
    if (res.url().includes('/api/')) {
      console.log(`RES: ${res.status()} ${res.url().replace('http://localhost:3000', '')}`);
    }
  });

  // Login usando el form correcto
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // El form de login tiene el h1 "Inicia sesión en tu cuenta" o similar
  // Usar el form que tiene los inputs de email/password
  const loginForm = page.locator('form').filter({ has: page.locator('input[type="email"]') });
  console.log(`Login forms encontrados: ${await loginForm.count()}`);
  
  await loginForm.locator('input[type="email"]').fill('gem_88@hotmail.com');
  await loginForm.locator('input[type="password"]').fill('odin8502');
  await page.waitForTimeout(500);
  
  console.log('\n=== Submit ===');
  await loginForm.locator('button[type="submit"]').click();
  await page.waitForTimeout(5000);
  
  console.log(`\nURL final: ${page.url()}`);
  
  // Ver localStorage
  const ls = await page.evaluate(() => {
    const items = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      items[key] = localStorage.getItem(key);
    }
    return items;
  });
  console.log('localStorage keys:', Object.keys(ls));
  
  if (ls['auth-storage']) {
    const parsed = JSON.parse(ls['auth-storage']);
    console.log('auth-storage.state.token:', parsed.state?.token?.substring(0, 30) || 'NO TOKEN');
    console.log('auth-storage.state.user.role:', parsed.state?.user?.role || 'NO ROLE');
  }
  
  // Si tiene token, ir a /admin/users
  if (ls['auth-storage'] && JSON.parse(ls['auth-storage']).state?.token) {
    console.log('\n=== Navegando a /admin/users/ ===');
    await page.goto('http://localhost:3000/admin/users/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    const rowCount = await page.locator('tbody tr').count();
    console.log(`Filas: ${rowCount}`);
    
    // Marcar toggle
    console.log('\n=== Marcando toggle ===');
    const label = page.locator('label:has-text("Mostrar eliminados")');
    const checkbox = label.locator('input[type="checkbox"]');
    await checkbox.check();
    await page.waitForTimeout(3000);
    
    const rowCountAfter = await page.locator('tbody tr').count();
    console.log(`Filas después: ${rowCountAfter}`);
    const eliminadoBadges = await page.locator('text="Eliminado"').count();
    console.log(`Badges "Eliminado": ${eliminadoBadges}`);
  }

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
