const fs = require('fs');
let code = fs.readFileSync('frontend/src/core/auth/postAuthRedirect.ts', 'utf8');
code = code.replace(
  `export function resolvePostAuthEntryPath(role: UserRole | undefined): string {`,
  `export function resolvePostAuthEntryPath(role: UserRole | undefined): string { console.log('RESOLVE_POST_AUTH_ENTRY_PATH_CALLED:', role);`
);
fs.writeFileSync('frontend/src/core/auth/postAuthRedirect.ts', code);
