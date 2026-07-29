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

  // Hacer el fetch directamente desde el navegador
  const result = await page.evaluate(async () => {
    const tokenRaw = window.localStorage.getItem('auth-storage');
    const parsed = JSON.parse(tokenRaw);
    const token = parsed.state.token;
    
    const resp = await fetch('/api/users/?skip=0&limit=1000&include_deleted=true', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await resp.json();
    return {
      total: data.length,
      withDeletedAt: data.filter(u => u.deleted_at).length,
      withoutDeletedAt: data.filter(u => !u.deleted_at).length,
      firstUser: data[0],
      deletedUsers: data.filter(u => u.deleted_at).slice(0, 3).map(u => ({ id: u.id, email: u.email, deleted_at: u.deleted_at })),
    };
  });
  
  console.log('=== Resultado del fetch desde el navegador ===');
  console.log(`Total: ${result.total}`);
  console.log(`Con deleted_at: ${result.withDeletedAt}`);
  console.log(`Sin deleted_at: ${result.withoutDeletedAt}`);
  console.log(`\nPrimer usuario:`);
  console.log(JSON.stringify(result.firstUser, null, 2).substring(0, 500));
  console.log(`\nUsuarios eliminados:`);
  result.deletedUsers.forEach(u => console.log(`  - ID ${u.id}: ${u.email} (deleted_at: ${u.deleted_at})`));

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
