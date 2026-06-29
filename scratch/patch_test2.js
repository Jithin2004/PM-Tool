const fs = require('fs');
let code = fs.readFileSync('testing/certification/IAM.spec.ts', 'utf8');
code = code.replace(
  `test('Admin capability: user.manage', async ({ page, context }) => {`,
  `test('Admin capability: user.manage', async ({ page, context }) => {
    page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
    await page.route('**/*', async route => {
      const response = await route.fetch();
      if (route.request().url().includes('/api/')) {
        console.log('BROWSER_NETWORK:', route.request().method(), route.request().url());
      }
      route.fulfill({
        response,
      });
    });
  `
);
fs.writeFileSync('testing/certification/IAM.spec.ts', code);
