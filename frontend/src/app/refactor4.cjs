const fs = require('fs');

let lines = fs.readFileSync('router.tsx', 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.startsWith('function SuspenseWrapper({ children }'));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.startsWith('export function ResolveRouter()'));

if (startIdx !== -1 && endIdx !== -1) {
  // Replace everything from startIdx to endIdx - 1
  const replacement = `function RouteShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  );
}

`;
  
  lines.splice(startIdx, endIdx - startIdx, replacement);
  fs.writeFileSync('router.tsx', lines.join('\n'));
  console.log('Successfully replaced SuspenseWrapper by line index!');
} else {
  console.log('Could not find start/end bounds for SuspenseWrapper');
}
