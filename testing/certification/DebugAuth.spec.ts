import { test, expect } from '@playwright/test';
import { SandboxIntegration } from '../sandbox/sandbox';

test.describe('Debug Auth Hook', () => {
  test('Trace execution of Login component', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('[DEBUG]')) {
        console.log('BROWSER_LOG:', msg.text());
      }
    });

    await page.addInitScript(() => {
      const originalReplace = window.history.replaceState;
      window.history.replaceState = function(...args) {
        console.log(`[DEBUG] replaceState called with: ${JSON.stringify(args)}`);
        console.log(`[DEBUG] pathname before replaceState: ${window.location.pathname}`);
        const result = originalReplace.apply(this, args);
        console.log(`[DEBUG] pathname after replaceState: ${window.location.pathname}`);
        return result;
      };

      const originalDispatch = window.dispatchEvent;
      window.dispatchEvent = function(event) {
        if (event.type === 'popstate') {
          console.log(`[DEBUG] popstate event dispatched`);
          setTimeout(() => {
             console.log(`[DEBUG] pathname 1 tick after popstate: ${window.location.pathname}`);
             const isLoginMounted = !!document.querySelector('button[type="submit"]');
             console.log(`[DEBUG] Is Login form still mounted? ${isLoginMounted}`);
          }, 0);
        }
        return originalDispatch.apply(this, arguments);
      };
    });

    await page.goto('http://localhost:3000/login');
    
      // Use valid dummy data matching the required schema
      const email = SandboxIntegration.getTestIdentity('Admin');
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', 'Password123!');
    
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/token') && 
      response.status() === 200
    );
    
    await page.click('button[type="submit"]');
    await responsePromise;
    
    console.log('[TEST_LOG] Backend Auth Successful');
    
    await page.waitForTimeout(2000);
    
    console.log(`[TEST_LOG] Final URL: ${page.url()}`);
    console.log(`[TEST_LOG] Final Login Component Mounted: ${await page.locator('button[type="submit"]').isVisible()}`);
  });
});
