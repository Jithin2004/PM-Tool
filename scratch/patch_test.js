const fs = require('fs');
let code = fs.readFileSync('testing/certification/IAM.spec.ts', 'utf8');
code = code.replace(
  `test('Admin capability: user.manage', async ({ page, context }) => {`,
  `test('Admin capability: user.manage', async ({ page, context }) => { page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));`
);
fs.writeFileSync('testing/certification/IAM.spec.ts', code);
