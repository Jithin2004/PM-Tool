const { chromium } = require('playwright');
const fs = require('fs');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  // Inject session from context.json
  const ctxStr = fs.readFileSync('testing/sandbox/context.json', 'utf8');
  const ctx = JSON.parse(ctxStr);
  const superAdmin = ctx.identities['Super Admin'];
  
  await context.addInitScript((session) => {
    window.localStorage.setItem('supabase.auth.token', JSON.stringify({
      currentSession: session,
      expiresAt: Math.floor(Date.now() / 1000) + 3600
    }));
  }, superAdmin.session);

  const page = await context.newPage();
  
  const pendingRequests = new Map();
  
  page.on('request', req => {
    pendingRequests.set(req.url(), Date.now());
    console.log(`[REQUEST] ${req.url()}`);
  });
  
  page.on('requestfinished', req => {
    const start = pendingRequests.get(req.url());
    pendingRequests.delete(req.url());
    console.log(`[FINISHED] ${req.url()} (${Date.now() - start}ms)`);
  });
  
  page.on('requestfailed', req => {
    pendingRequests.delete(req.url());
    console.log(`[FAILED] ${req.url()} - ${req.failure().errorText}`);
  });
  
  page.on('console', msg => {
    console.log(`[PAGE LOG] ${msg.text()}`);
  });
  
  console.log('Navigating to /admin/settings...');
  
  try {
    await page.goto('http://localhost:3000/admin/settings', { timeout: 15000, waitUntil: 'load' });
    console.log('waiting 10 seconds...');
    await page.waitForTimeout(10000);
  } catch (e) {
    console.log('Navigation or wait timeout:', e.message);
  }
  
  console.log('--- PENDING REQUESTS ---');
  for (const url of pendingRequests.keys()) {
    console.log(`PENDING: ${url}`);
  }
  
  await browser.close();
}

run().catch(console.error);
