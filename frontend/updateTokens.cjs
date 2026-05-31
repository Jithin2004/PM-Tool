const fs = require('fs');

let css = fs.readFileSync('src/index.css', 'utf8');

const darkTokens = `
  --pm-surface-elevated:      #282a2c;
  --pm-border:                rgba(255, 255, 255, 0.08);
  --pm-text:                  #e2e2e5;
  --pm-text-secondary:        #c7c4d7;`;

css = css.replace(/(--pm-surface-variant:\s*#[0-9a-fA-F]+;)/, '$1\n' + darkTokens);

const lightTokens = `
  --pm-surface-elevated:      #FFFFFF;
  --pm-border:                #D8D1C7;
  --pm-text:                  #1F2937;
  --pm-text-secondary:        #6B7280;`;

css = css.replace(/(--pm-surface-variant:\s*#[0-9a-fA-F]+;\s*\n\s*--pm-on-surface)/, lightTokens.trim() + '\n\n  --pm-on-surface');

fs.writeFileSync('src/index.css', css);
console.log("Updated index.css");
