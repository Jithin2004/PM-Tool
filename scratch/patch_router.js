const fs = require('fs');
let code = fs.readFileSync('frontend/src/app/router.tsx', 'utf8');
code = code.replace(
  `function redirectTo(target: string): void {`,
  `function redirectTo(target: string): void { console.log('REDIRECT_CALLED:', target, new Error().stack);`
);
fs.writeFileSync('frontend/src/app/router.tsx', code);
