const fs = require('fs');
const path = require('path');

const dirs = ['src/pages', 'src/landing', 'src/app', 'src/layouts', 'src/core', 'src/services'];
let modifiedCount = 0;
let fileCount = 0;

function processFile(filePath) {
  let original = fs.readFileSync(filePath, 'utf8');
  let content = original;

  // 1. Elevated Panels (bg-white + shadow-*)
  content = content.replace(/bg-white([^\"\'\`]+)shadow-/g, 'bg-[var(--pm-surface-elevated)]$1shadow-');
  
  // 2. Remaining bg-white
  content = content.replace(/bg-white/g, 'bg-[var(--pm-surface)]');

  // 3. Gray/Slate backgrounds
  content = content.replace(/bg-(gray|slate)-[1-9]00/g, 'bg-[var(--pm-surface)]');
  content = content.replace(/bg-(gray|slate)-50/g, 'bg-[var(--pm-surface)]');

  // 4. Borders
  content = content.replace(/border-(gray|slate)-[1-9]00/g, 'border-[var(--pm-border)]');

  // 5. Primary Text (text-black, text-gray-900, text-slate-900)
  content = content.replace(/text-black/g, 'text-[var(--pm-text)]');
  content = content.replace(/text-(gray|slate)-(800|900|950)/g, 'text-[var(--pm-text)]');

  // 6. Secondary Text (text-gray-500, text-gray-600, text-slate-500, etc)
  content = content.replace(/text-(gray|slate)-(300|400|500|600|700)/g, 'text-[var(--pm-text-secondary)]');

  if (original !== content) {
    fs.writeFileSync(filePath, content);
    modifiedCount++;
    console.log(`Modified: ${filePath}`);
  }
  fileCount++;
}

function scan(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      scan(full);
    } else if (full.endsWith('.tsx') || full.endsWith('.ts')) {
      processFile(full);
    }
  }
}

dirs.forEach(scan);
console.log(`\nSecondary Scan complete. Scanned ${fileCount} files, modified ${modifiedCount} files.`);
