
const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'pages/resources/FinancePage.tsx',
  'pages/control/DocumentTemplatesPage.tsx',
  'components/hr/DocumentGeneratorDropdown.tsx',
  'components/user/UserProfileModal.tsx',
  'components/resources/ManageSkillsModal.tsx',
  'components/finance/ManageClientsModal.tsx',
  'components/project/ProjectDetailsModal.tsx',
  'components/control/AuditView.tsx',
  'components/admin/LogisticsDashboard.tsx',
  'components/admin/AdminDashboard.tsx',
  'components/calendar/CalendarView.tsx',
  'components/common/FilePanel.tsx',
  'components/auth/ProductKeyGate.tsx'
];

filesToUpdate.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  content = content.replace(/window\.confirm/g, 'confirm');
  content = content.replace(/window\.prompt/g, 'prompt');
  content = content.replace(/window\.alert/g, 'alert');

  content = content.replace(/confirm\(/g, 'await showConfirm(');
  content = content.replace(/prompt\(/g, 'await showPrompt(');
  
  content = content.replace(/=>\s*alert\(/g, '=> showAlert('); 
  content = content.replace(/\balert\(/g, 'showAlert(');

  const depth = file.split('/').length - 1;
  const relativePath = '../'.repeat(depth) + 'components/common/Dialogs';
  
  if (!content.includes('Dialogs')) {
    const importStmt = 'import { showAlert, showConfirm, showPrompt } from \'' + relativePath + '\';\n';
    const lastImportIndex = content.lastIndexOf('import ');
    const insertPos = content.indexOf('\n', lastImportIndex) + 1;
    content = content.slice(0, insertPos) + importStmt + content.slice(insertPos);
  }

  fs.writeFileSync(filePath, content, 'utf8');
});


