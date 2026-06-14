const fs = require('fs');

const path = 'c:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/database/production/RESOLVE_PM_V1_3_INSTALL.sql';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

const fkRefs = [];
let currentTable = null;

// Find FK constraints that reference users
for (let i = 0; i < lines.length; i++) {
  const createMatch = lines[i].match(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(public\.)?(\w+)\s*\(/i);
  if (createMatch) currentTable = createMatch[2];

  // Inline FK references
  const inlineFK = lines[i].match(/(\w+)\s+(?:uuid|integer).*REFERENCES\s+(?:public\.)?users\s*\(\s*id\s*\)\s+ON DELETE\s+(\w+)/i);
  if (inlineFK && currentTable) {
    fkRefs.push({ lineNum: i, table: currentTable, column: inlineFK[1], action: inlineFK[2], authRef: false });
  }

  // Also check REFERENCES auth.users
  const authFK = lines[i].match(/(\w+)\s+uuid.*REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s+ON DELETE\s+(\w+)/i);
  if (authFK && currentTable) {
    fkRefs.push({ lineNum: i, table: currentTable, column: authFK[1], action: authFK[2], authRef: true });
  }

  // ALTER TABLE ADD CONSTRAINT style
  const alterFK = lines[i].match(/FOREIGN KEY\s*\(\s*(\w+)\s*\)\s+REFERENCES\s+(?:public\.)?users\s*\(\s*id\s*\)\s+ON DELETE\s+(\w+)/i);
  if (alterFK) {
    // Find the ALTER TABLE name
    for (let j = i; j >= Math.max(0, i - 5); j--) {
      const alterMatch = lines[j].match(/ALTER TABLE\s+(public\.)?(\w+)/i);
      if (alterMatch) {
        fkRefs.push({ lineNum: i, table: alterMatch[2], column: alterFK[1], action: alterFK[2], authRef: false });
        break;
      }
    }
  }
}

const cascadeRefs = fkRefs.filter(r => r.action.toUpperCase() === 'CASCADE');

console.log("Current CASCADE references to users:");
console.table(cascadeRefs);
