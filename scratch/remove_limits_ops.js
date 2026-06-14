const fs = require('fs');
const path = require('path');

const filePath = path.resolve('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/services/operationalDataService.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\.limit\(50\)/g, '');

fs.writeFileSync(filePath, content);
console.log('Removed .limit(50) from operationalDataService.ts');
