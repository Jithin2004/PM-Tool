import { test } from '@playwright/test';
import { SandboxIntegration } from '../sandbox/sandbox';
import { CertificationSession, CertificationNavigation, CertificationAssertion } from '../helpers/certification';

test.describe('Projects Certification Pack', () => {
  test.beforeAll(async () => {
    SandboxIntegration.getSharedContext();
  });

  test.afterAll(async () => {
    // Sandbox destruction is handled by the master runner
  });

  test.beforeEach(async ({ page }) => {
    await CertificationSession.login(page, 'Admin');
  });

  test('Create Project Flow', async ({ page }) => {
    await CertificationNavigation.navigateTo(page, '/projects/new');
    await page.fill('input[name="projectName"]', 'Certification Project');
    
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/rest/v1/projects') &&
      response.status() === 201
    );
    
    await page.click('button[type="submit"]');
    await responsePromise;
    await page.locator('text=Project created').waitFor({ state: 'visible' });
  });

  test('Edit Project Flow', async ({ page }) => {
    await CertificationNavigation.navigateTo(page, '/projects/1/edit');
    await page.fill('input[name="projectName"]', 'Updated Certification Project');
    
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/rest/v1/projects') &&
      response.status() === 204
    );
    
    await page.click('button[type="submit"]');
    await responsePromise;
    await page.locator('text=Project updated').waitFor({ state: 'visible' });
  });

  test('Archive and Restore Project', async ({ page }) => {
    await CertificationNavigation.navigateTo(page, '/projects/1/settings');
    
    let responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/rest/v1/projects') &&
      response.status() === 204
    );
    
    await page.click('button:has-text("Archive Project")');
    await page.click('button:has-text("Confirm Archive")');
    await responsePromise;
    await page.locator('text=Project archived').waitFor({ state: 'visible' });
    
    // Restore
    responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/rest/v1/projects') &&
      response.status() === 204
    );
    
    await page.click('button:has-text("Restore Project")');
    await responsePromise;
    await page.locator('text=Project restored').waitFor({ state: 'visible' });
  });

  test('Realtime synchronization on Status Change', async ({ browser, page }) => {
    // page is already logged in as Admin via beforeEach
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    
    await CertificationSession.login(pageB, 'QA');
    
    await CertificationNavigation.navigateTo(page, '/projects/1');
    await CertificationNavigation.navigateTo(pageB, '/projects/1');
    
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/rest/v1/projects') &&
      response.status() === 204
    );
    
    // Change status in A
    await page.click('button[aria-label="Change Status"]');
    await page.click('text=In Progress');
    await responsePromise;
    
    // Verify in B automatically without reload
    await pageB.locator('text=In Progress').waitFor({ state: 'visible' });
  });
});
