import { test, expect } from '@playwright/test';
import { SandboxIntegration } from '../sandbox/sandbox';

test.describe('Debug License Flow', () => {
  test('Should handle valid enterprise license flow', async ({ page }) => {
    // Phase 1: Authentication Gate
    await page.goto('http://localhost:3000/login');
    const email = SandboxIntegration.getTestIdentity('Admin');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Password123!');
    
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/token') && r.status() === 200),
      page.click('button[type="submit"]')
    ]);
    
    console.log('[TEST_LOG] Logged in successfully.');
    
    // Wait for the redirect to /activate-license
    await page.waitForURL('**/activate-license', { timeout: 10000 });
    console.log(`[TEST_LOG] Current URL: ${page.url()}`);

    // Extract state
    const state = await page.evaluate(() => {
      const ls = { ...window.localStorage };
      const ss = { ...window.sessionStorage };
      return { localStorage: ls, sessionStorage: ss };
    });
    
    console.log('[TEST_LOG] Local Storage:', JSON.stringify(state.localStorage, null, 2));
    
    // Attempt to parse supabase auth token to get user info
    const tokenStr = Object.keys(state.localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (tokenStr) {
       const token = JSON.parse(state.localStorage[tokenStr]);
       console.log('[TEST_LOG] Auth Token User Meta:', JSON.stringify(token?.user?.user_metadata, null, 2));
    }
  });
});
