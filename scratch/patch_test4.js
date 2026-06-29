const fs = require('fs');
let code = fs.readFileSync('testing/certification/IAM.spec.ts', 'utf8');

// First remove my previous patch that dumped HTML
code = code.replace(
  `const html = await page.content();
    require('fs').writeFileSync('admin_debug_dom.html', html);
    await page.screenshot({ path: 'admin_debug_screenshot.png' });
    await expect(page.locator('h1:has-text("Access Control")')).toBeVisible({ timeout: 60000 });`,
  `await expect(page.locator('h1:has-text("Access Control")')).toBeVisible({ timeout: 15000 });`
);

fs.writeFileSync('testing/certification/IAM.spec.ts', code);
console.log('Restored IAM.spec.ts');
