const fs = require('fs');

const path = 'src/index.css';
let content = fs.readFileSync(path, 'utf8');

// Replace PM tokens in the :root block
content = content.replace(/--pm-bg:\s*#[a-f0-9A-F]+;/, '--pm-bg: #0B1120;');
content = content.replace(/--pm-surface:\s*#[a-f0-9A-F]+;/, '--pm-surface: #111827;');
content = content.replace(/--pm-surface-elevated:\s*#[a-f0-9A-F]+;/, '--pm-surface-elevated: #1F2937;');
content = content.replace(/--pm-border:\s*rgba\([^)]+\);/, '--pm-border: #4B5563;');
content = content.replace(/--pm-text:\s*#[a-f0-9A-F]+;/, '--pm-text: #F3F4F6;');
content = content.replace(/--pm-text-secondary:\s*#[a-f0-9A-F]+;/, '--pm-text-secondary: #9CA3AF;');
content = content.replace(/--pm-primary:\s*#[a-f0-9A-F]+;/, '--pm-primary: #7C3AED;');

// We also need to map the new variables if they aren't there yet (cyan, success, warning, risk, panel, structure)
// Let's just insert them below --pm-text-secondary
if (!content.includes('--pm-structure:')) {
  content = content.replace('--pm-text-secondary:        #c7c4d7;', `--pm-text-secondary:        #9CA3AF;
  --pm-structure:             #374151;
  --pm-panel:                 #1E293B;
  --pm-cyan:                  #06B6D4;
  --pm-success:               #10B981;
  --pm-warning:               #F59E0B;
  --pm-risk:                  #EF4444;`);
}

// Ensure the legacy global variables also reflect the new Dark Theme so things don't clash.
content = content.replace(/--bg:\s*#09090b;/, '--bg: #0B1120;');
content = content.replace(/--surface:\s*#121214;/, '--surface: #111827;');
content = content.replace(/--surface-2:\s*#18181b;/, '--surface-2: #1F2937;');
content = content.replace(/--surface-3:\s*#27272a;/, '--surface-3: #1E293B;'); // panel
content = content.replace(/--border:\s*rgba\([^)]+\);/, '--border: #4B5563;');

fs.writeFileSync(path, content);
console.log('Tokens replaced successfully');
