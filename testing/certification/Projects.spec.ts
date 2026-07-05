import { test } from '@playwright/test';
import { SandboxIntegration } from '../sandbox/sandbox';
import { CertificationSession, CertificationNavigation, CertificationAssertion } from '../helpers/certification';

test.describe('Projects Certification Pack', () => {
  let firstProjectId: string;

  test.beforeAll(async () => {
    SandboxIntegration.getSharedContext();
  });

  test.afterAll(async () => {
    // Sandbox destruction is handled by the master runner
  });

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
      }
    });
    await CertificationSession.login(page, 'Admin');
  });

  test('Create Project Flow', async ({ page }) => {
    await CertificationNavigation.navigateTo(page, '/projects/new');
    await page.fill('input[name="projectName"]', 'Certification Project');
    
    await page.click('button[type="submit"]');
    await page.locator('text=Project created').waitFor({ state: 'visible', timeout: 15000 });
  });

  test('Edit Project Flow', async ({ page }) => {
    // Navigate to workspace to trigger projects fetch and intercept the response
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/rest/v1/projects') &&
      response.request().method() === 'GET'
    );
    await CertificationNavigation.navigateTo(page, '/workspace');
    
    const response = await responsePromise;
    const projects = await response.json();
    
    if (!projects || projects.length === 0) throw new Error('No seeded project found');
    firstProjectId = projects[0].id;
    
    await CertificationNavigation.navigateTo(page, `/projects/${firstProjectId}/edit`);
    await page.fill('input[name="projectName"]', 'Updated Certification Project');
    
    await page.click('button[type="submit"]');
    await page.locator('text=Project updated').waitFor({ state: 'visible', timeout: 15000 });
  });

  test('Archive and Restore Project', async ({ page }) => {
    // Use the project ID discovered in the Edit test, or discover again
    if (!firstProjectId) {
      const responsePromise = page.waitForResponse(response => 
        response.url().includes('supabase.co') && 
        response.url().includes('/rest/v1/projects') &&
        response.request().method() === 'GET'
      );
      await CertificationNavigation.navigateTo(page, '/workspace');
      const response = await responsePromise;
      const projects = await response.json();
      firstProjectId = projects?.[0]?.id || '';
    }
    
    if (!firstProjectId) throw new Error('No seeded project found');
    
    await CertificationNavigation.navigateTo(page, `/projects/${firstProjectId}/settings`);
    
    await page.click('button:has-text("Archive Project")');
    await page.click('button:has-text("Confirm Archive")');
    await page.locator('text=Project archived').waitFor({ state: 'visible', timeout: 15000 });
    
    // Restore
    await page.click('button:has-text("Restore Project")');
    await page.locator('text=Project restored').waitFor({ state: 'visible', timeout: 15000 });
  });

  test('Realtime synchronization on Status Change', async ({ browser, page }) => {
    // Discover a project ID
    if (!firstProjectId) {
      const responsePromise = page.waitForResponse(response => 
        response.url().includes('supabase.co') && 
        response.url().includes('/rest/v1/projects') &&
        response.request().method() === 'GET'
      );
      await CertificationNavigation.navigateTo(page, '/workspace');
      const response = await responsePromise;
      const projects = await response.json();
      firstProjectId = projects?.[0]?.id || '';
    }
    
    if (!firstProjectId) throw new Error('No seeded project found');
    
    // page is already logged in as Admin via beforeEach
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    
    await CertificationSession.login(pageB, 'QA');
    
    await CertificationNavigation.navigateTo(page, `/projects/${firstProjectId}`);
    await CertificationNavigation.navigateTo(pageB, `/projects/${firstProjectId}`);
    
    // Change status in A
    await page.click('button[aria-label="Change Status"]');
    await page.click('text=In Progress');
    
    // Verify in B automatically without reload
    await pageB.locator('text=In Progress').waitFor({ state: 'visible', timeout: 15000 });
  });
});
