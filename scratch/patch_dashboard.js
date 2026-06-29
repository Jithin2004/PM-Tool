const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/dashboard/DashboardLayout.tsx', 'utf8');

code = code.replace(
  `import { OperationalDataProvider, useOperationalData } from '../../context/OperationalDataContext';`,
  `import { OperationalDataProvider, useOperationalData, OperationalDataContext as ODC_LOCAL } from '../../context/OperationalDataContext';`
);

code = code.replace(
  `export default function DashboardLayout({ children }: { children?: React.ReactNode }) {`,
  `export default function DashboardLayout({ children }: { children?: React.ReactNode }) {\n  console.log('DASHBOARD LAYOUT using ODC UID:', (ODC_LOCAL as any)._uid);`
);

fs.writeFileSync('frontend/src/pages/dashboard/DashboardLayout.tsx', code);
console.log('Patched DashboardLayout.tsx!');
