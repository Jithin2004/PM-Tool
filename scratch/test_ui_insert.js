const { chromium } = require('playwright');
require('dotenv').config({ path: 'frontend/.env' });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:3000/auth/login');
  await page.fill('input[type="email"]', 'projectmanager-e2e@example.com');
  await page.fill('input[type="password"]', 'Password123!');
  await page.click('button[type="submit"]');
  
  await page.waitForURL('**/dashboard');
  
  await page.goto('http://localhost:3000/projects');
  
  // Listen for the network response to /rest/v1/projects
  page.on('response', async (response) => {
    if (response.url().includes('/projects') && response.request().method() === 'POST') {
      console.log('Project Insert Status:', response.status());
      console.log('Project Insert Response:', await response.text());
    }
  });

  // Try to create a project
  try {
    await page.click('button:has-text("New Project"), button:has-text("Create Project")');
    await page.waitForTimeout(1000); // wait for modal
    await page.fill('input[name="name"]', 'My New Playwright Project');
    // Fill out any other required fields or just submit
    await page.click('button:has-text("Create")'); // adjust selector
    await page.waitForTimeout(3000);
  } catch(e) {
    console.log('Could not create project via UI:', e.message);
  }
  
  await browser.close();
}

run();
