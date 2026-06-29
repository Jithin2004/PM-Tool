const fs = require('fs');
let code = fs.readFileSync('frontend/src/context/RealtimeProvider.tsx', 'utf8');

code = code.replace(
  `export function RealtimeProvider({ children }: { children: React.ReactNode }) {`,
  `import { OperationalDataContext as ODC_LOCAL } from './OperationalDataContext';\nexport function RealtimeProvider({ children }: { children: React.ReactNode }) {\n  console.log('REALTIME PROVIDER using ODC UID:', (ODC_LOCAL as any)._uid);`
);

fs.writeFileSync('frontend/src/context/RealtimeProvider.tsx', code);
console.log('Patched RealtimeProvider!');
