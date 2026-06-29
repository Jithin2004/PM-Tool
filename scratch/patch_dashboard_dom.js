const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/dashboard/DashboardLayout.tsx', 'utf8');
code = code.replace(
  `{children}`,
  `{children}<div id="antigravity-debug" style={{position:'fixed',top:0,left:0,zIndex:9999,background:'black',color:'lime',padding:'10px'}}>DEBUG_IS_VIEW: {JSON.stringify(hasCapability(profile, 'project.view') && !hasCapability(profile, 'task.update'))} DEBUG_ROLE: {profile?.role} DEBUG_TOUR: {showGuide ? 'true' : 'false'} DEBUG_DISCLOSURE: {disclosure?.active ? 'true' : 'false'} DEBUG_PATH: {routePath}</div>`
);
fs.writeFileSync('frontend/src/pages/dashboard/DashboardLayout.tsx', code);
