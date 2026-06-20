const fs = require('fs');
let content = fs.readFileSync('router.tsx', 'utf8');

// 1. imports
content = content.replace(/import React, \{ lazy, Suspense, useEffect, useRef, useState \} from 'react';/, "import React, { useEffect, useRef, useState } from 'react';");

// 2. withRetry definition
content = content.replace(/const withRetry = \([\s\S]*?return \{ default: \(\) => .*? \};\n    \}\n  \}\);\n\};\n\n/, '');

// 3. route mappings
content = content.replace(/const (\w+) = withRetry\(\(\) => import\('([^']+)'\)(?:\.then\(m => \(\{ default: m\.\w+ \}\)\))?\);/g, (match, name, path) => {
  if (match.includes('.then(')) {
    return `import { ${name} } from '${path}';`;
  } else {
    return `import ${name} from '${path}';`;
  }
});

// 4. PasswordSetup lazy
content = content.replace(/const PasswordSetup = lazy\(\(\) => import\('\.\.\/components\/auth\/PasswordSetup'\)\.then\(m => \(\{ default: m\.PasswordSetup \}\)\)\);/g, '');

if (content.includes("import { Login } from '../components/auth/Login';")) {
  content = content.replace("import { Login } from '../components/auth/Login';", "import { Login } from '../components/auth/Login';\nimport { PasswordSetup } from '../components/auth/PasswordSetup';");
}

// 5. Replace RouteFallback entirely
content = content.replace(/function RouteFallback\(\) \{[\s\S]*?const FALLBACK = <RouteFallback \/>;\n\n/g, '');

// 6. Replace explicit <Suspense fallback={FALLBACK}><Comp /></Suspense> with <Comp />
content = content.replace(/<Suspense fallback=\{FALLBACK\}>\s*(<[A-Za-z0-9_]+ \/>)\s*<\/Suspense>/g, '$1');

fs.writeFileSync('router.tsx', content);

