const fs = require('fs');
let content = fs.readFileSync('router.tsx', 'utf8');

// 1. Remove lazy and Suspense from import
content = content.replace(/import React, \{ lazy, Suspense, useEffect, useRef, useState \} from 'react';/, "import React, { useEffect, useRef, useState } from 'react';");

// 2. Remove withRetry definition
content = content.replace(/const withRetry = \([\s\S]*?return \{ default: \(\) => .*? \};\n    \}\n  \}\);\n\};\n\n/, '');

// 3. Convert withRetry declarations to static imports
content = content.replace(/const (\w+) = withRetry\(\(\) => import\('([^']+)'\)(?:\.then\(m => \(\{ default: m\.\w+ \}\)\))?\);/g, (match, name, path) => {
  if (match.includes('.then(')) {
    return `import { ${name} } from '${path}';`;
  } else {
    return `import ${name} from '${path}';`;
  }
});

// 4. Convert remaining lazy usages if any (e.g. PasswordSetup)
content = content.replace(/const (\w+) = lazy\(\(\) => import\('([^']+)'\)(?:\.then\(m => \(\{ default: m\.\w+ \}\)\))?\);/g, (match, name, path) => {
  if (match.includes('.then(')) {
    return `import { ${name} } from '${path}';`;
  } else {
    return `import ${name} from '${path}';`;
  }
});

// Move PasswordSetup import to top if it was inline
if (content.includes("import { PasswordSetup } from '../components/auth/PasswordSetup';")) {
    content = content.replace("import { PasswordSetup } from '../components/auth/PasswordSetup';", "");
    content = content.replace("import { Login } from '../components/auth/Login';", "import { Login } from '../components/auth/Login';\nimport { PasswordSetup } from '../components/auth/PasswordSetup';");
}

// 5. Remove RouteFallback, FALLBACK, and SuspenseWrapper
// Note: We'll replace the SuspenseWrapper implementation to just render children directly,
// and remove RouteFallback entirely.
content = content.replace(/function RouteFallback\(\) \{[\s\S]*?const FALLBACK = <RouteFallback \/>;\n\n/g, '');

content = content.replace(/function SuspenseWrapper\(\{ children \}: \{ children: React\.ReactNode \}\) \{[\s\S]*?return <Suspense key=\{\`\$\{pathname\}-\$\{remountKey\}\`\} fallback=\{FALLBACK\}>\{children\}<\/Suspense>;\n\}\n\n/g, '');

// 6. Rewrite RouteShell to not use SuspenseWrapper
content = content.replace(/function RouteShell\(\{ children \}: \{ children: React\.ReactNode \}\) \{[\s\S]*?return \(\n    <DashboardLayout>\n      <SuspenseWrapper>\{children\}<\/SuspenseWrapper>\n    <\/DashboardLayout>\n  \);\n\}/g, `function RouteShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  );
}`);

// 7. Remove `<Suspense fallback={FALLBACK}>` and `</Suspense>` everywhere
content = content.replace(/<Suspense fallback=\{FALLBACK\}>/g, '');
content = content.replace(/<\/Suspense>/g, '');

fs.writeFileSync('router.tsx', content);

