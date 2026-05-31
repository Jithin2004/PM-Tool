const fs = require('fs');
let c = fs.readFileSync('src/index.css', 'utf8');

if (!c.includes('--pm-surface-hover:')) {
  c = c.replace('--pm-surface-variant:       #333537;', '--pm-surface-variant:       #333537;\n  --pm-surface-hover:         #334155;');
}

if (!c.includes('input:focus')) {
  c += '\n\n/* Form Focus Rings (No Glow, Soft Cyan) */\ninput:focus, select:focus, textarea:focus {\n  outline: none;\n  border-color: transparent !important;\n  box-shadow: 0 0 0 2px var(--pm-cyan) !important;\n}\n';
}

fs.writeFileSync('src/index.css', c);
console.log('Phase A index.css updates applied.');
