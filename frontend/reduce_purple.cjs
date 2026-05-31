const fs = require('fs');

const path = 'src/pages/dashboard/DashboardLayout.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/background:\s*groupBg,/g, "background: 'var(--pm-surface-high)',");
content = content.replace(/background:\s*'rgba\(79,70,229,0\.1\)',/g, "background: 'var(--pm-surface-high)',");
content = content.replace(/background:\s*'rgba\(79, 70, 229, 0\.1\)',/g, "background: 'var(--pm-surface-high)',");

fs.writeFileSync(path, content);
console.log('Sidebar purple reduction applied.');
