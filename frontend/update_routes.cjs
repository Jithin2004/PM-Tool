const fs = require('fs');

// 1. Update router.tsx
let routerContent = fs.readFileSync('./src/app/router.tsx', 'utf8');

routerContent = routerContent.replace(
  /const ProjectsPage = lazy/, 
  "const OverviewPage = lazy(() => import('../pages/dashboard/OverviewPage'));\nconst ProjectsPage = lazy"
);

routerContent = routerContent.replace(
  /\/\/ ── WORKSPACE routes ──/,
  "// ── WORKSPACE routes ──\n\n  if (pathname === '/overview') {\n    return <RouteShell><OverviewPage /></RouteShell>;\n  }\n"
);

routerContent = routerContent.replace(/window\.history\.replaceState\(null, '', '\/workspace'\);/g, "window.history.replaceState(null, '', '/overview');");
routerContent = routerContent.replace(/window\.history\.pushState\(null, '', '\/workspace'\);/g, "window.history.pushState(null, '', '/overview');");

routerContent = routerContent.replace(/return <RouteShell><ProjectsPage \/><\/RouteShell>;\s*}$/, "return <RouteShell><OverviewPage /></RouteShell>;\n}");

fs.writeFileSync('./src/app/router.tsx', routerContent);

// 2. Update DashboardLayout.tsx
let layoutContent = fs.readFileSync('./src/pages/dashboard/DashboardLayout.tsx', 'utf8');

layoutContent = layoutContent.replace(
  /onClick=\{\(\) => \{ setDashboardTab\('dashboard'\); navigateTo\('\/workspace'\); \}\}/,
  "onClick={() => navigateTo('/overview')}"
);

layoutContent = layoutContent.replace(
  /dashboardTab === 'dashboard' && window\.location\.pathname === '\/workspace'/,
  "window.location.pathname === '/overview' || window.location.pathname === '/'"
);

layoutContent = layoutContent.replace(
  /onClick=\{\(\) => \{ setDashboardTab\('active'\); navigateTo\('\/workspace'\); \}\}/,
  "onClick={() => navigateTo('/workspace')}"
);

layoutContent = layoutContent.replace(
  /dashboardTab === 'active' && window\.location\.pathname === '\/workspace'/,
  "window.location.pathname === '/workspace'"
);

// Mobile sidebar links too
layoutContent = layoutContent.replace(
  /onClick=\{\(\) => \{\n\s*setDashboardTab\('dashboard'\);\n\s*navigateTo\('\/workspace'\);\n\s*\}\}/,
  "onClick={() => { navigateTo('/overview'); }}"
);
layoutContent = layoutContent.replace(
  /onClick=\{\(\) => \{\n\s*setDashboardTab\('active'\);\n\s*navigateTo\('\/workspace'\);\n\s*\}\}/,
  "onClick={() => { navigateTo('/workspace'); }}"
);

fs.writeFileSync('./src/pages/dashboard/DashboardLayout.tsx', layoutContent);

console.log('Router and Layout updated.');
