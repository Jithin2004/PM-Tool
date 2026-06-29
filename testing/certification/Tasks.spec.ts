import { test } from '@playwright/test';
import { SandboxIntegration } from '../sandbox/sandbox';
import { CertificationSession, CertificationNavigation, CertificationAssertion } from '../helpers/certification';

test.describe('Tasks Certification Pack', () => {
  test.beforeAll(async () => {
    SandboxIntegration.getSharedContext();
  });

  test.afterAll(async () => {
    // Sandbox destruction is handled by the master runner
  });

  test.beforeEach(async ({ page }) => {
    await CertificationSession.login(page, 'Admin');
  });

  test('Create and Edit Task Flow', async ({ page }) => {
    await CertificationNavigation.navigateTo(page, '/projects/1/tasks/new');
    await page.fill('input[name="taskTitle"]', 'Certification Task');
    
    let responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/rest/v1/tasks') &&
      response.status() === 201
    );
    
    await page.click('button[type="submit"]');
    await responsePromise;
    await page.locator('text=Task created').waitFor({ state: 'visible' });

    await page.click('text=Edit Task');
    await page.fill('input[name="taskTitle"]', 'Updated Certification Task');
    
    responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/rest/v1/tasks') &&
      response.status() === 204
    );
    
    await page.click('button[type="submit"]');
    await responsePromise;
    await page.locator('text=Task updated').waitFor({ state: 'visible' });
  });

  test('Realtime synchronization on Assignment', async ({ browser, page }) => {
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    
    await CertificationSession.login(pageB, 'QA');
    
    await CertificationNavigation.navigateTo(page, '/projects/1/tasks/1');
    await CertificationNavigation.navigateTo(pageB, '/projects/1/tasks/1');
    
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/rest/v1/tasks') &&
      response.status() === 204
    );
    
    // Assign in A
    await page.click('button[aria-label="Assign User"]');
    await page.click('text=Developer John');
    await responsePromise;
    
    // Verify in B automatically
    await pageB.locator('text=Assigned to: Developer John').waitFor({ state: 'visible' });
  });

  test('Dependencies and Wait States', async ({ page }) => {
    await CertificationNavigation.navigateTo(page, '/projects/1/tasks/1');
    
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/rest/v1/task_dependencies') &&
      response.status() === 201
    );
    
    await page.click('button[aria-label="Add Dependency"]');
    await page.click('text=Task 2');
    await responsePromise;
    await page.locator('text=Blocks Task 2').waitFor({ state: 'visible' });
  });

  test('Task Deletion', async ({ page }) => {
    await CertificationNavigation.navigateTo(page, '/projects/1/tasks/1');
    
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/rest/v1/tasks') &&
      response.status() === 204
    );
    
    await page.click('button:has-text("Delete Task")');
    await page.click('button:has-text("Confirm Delete")');
    await responsePromise;
    await page.locator('text=Task deleted').waitFor({ state: 'visible' });
  });
});
