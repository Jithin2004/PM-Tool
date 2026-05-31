const fs = require('fs');

let c = fs.readFileSync('src/index.css', 'utf8');

// ─────────────────────────────────────────────────────────
// 1. Insert --pm-surface-hover (Phase A) after --pm-surface-variant
// ─────────────────────────────────────────────────────────
if (!c.includes('--pm-surface-hover')) {
  c = c.replace(
    '--pm-surface-variant:       #333537;',
    '--pm-surface-variant:       #333537;\n  --pm-surface-hover:         #334155;'
  );
  console.log('Added --pm-surface-hover');
}

// ─────────────────────────────────────────────────────────
// 2. Insert Signature Artifact token aliases before closing } of PM :root
//    We insert before the "/* Outline */" comment so we don't break existing structure
// ─────────────────────────────────────────────────────────
const signatureTokens = `
  /* ── Signature Artifact Aliases ──────────────────────────────── */
  /* Text hierarchy */
  --pm-text:                  #e2e2e5;
  --pm-text-secondary:        #c7c4d7;
  --pm-text-tertiary:         #71717a;
  --pm-text-quaternary:       #3f3f46;

  /* Signal colors */
  --pm-risk:                  #f87171;
  --pm-risk-bg:               rgba(248, 113, 113, 0.07);
  --pm-warning:               #fbbf24;
  --pm-warning-bg:            rgba(251, 191, 36, 0.07);
  --pm-success:               #34d399;
  --pm-success-bg:            rgba(52, 211, 153, 0.07);

  /* Intelligence accent */
  --pm-cyan:                  #22d3ee;

  /* Layer 3 panels */
  --pm-panel:                 #1E293B;

  /* Elevated surface + border */
  --pm-surface-elevated:      #1F2937;
  --pm-border:                #4B5563;
`;

if (!c.includes('--pm-text:')) {
  // Insert before the Outline section
  c = c.replace(
    '  /* Outline */',
    signatureTokens + '\n  /* Outline */'
  );
  console.log('Added Signature Artifact tokens (dark)');
}

// ─────────────────────────────────────────────────────────
// 3. Add light-mode overrides for the new tokens
//    Insert before the closing } of the .light block
// ─────────────────────────────────────────────────────────
const lightTokens = `
  /* ── Signature Artifact Aliases (Light) ──────────────────────── */
  --pm-text:                  #1F2937;
  --pm-text-secondary:        #6B7280;
  --pm-text-tertiary:         #9CA3AF;
  --pm-text-quaternary:       #D1D5DB;

  --pm-risk:                  #e11d48;
  --pm-risk-bg:               rgba(225, 29, 72, 0.08);
  --pm-warning:               #d97706;
  --pm-warning-bg:            rgba(217, 119, 6, 0.08);
  --pm-success:               #059669;
  --pm-success-bg:            rgba(5, 150, 105, 0.08);

  --pm-cyan:                  #0891b2;
  --pm-panel:                 #F8FAFC;
  --pm-surface-elevated:      #FFFFFF;
  --pm-surface-hover:         #F1EEE8;
  --pm-border:                #D8D1C7;
`;

if (!c.includes('Signature Artifact Aliases (Light)')) {
  // Find the closing } of the .light block that has PM tokens
  // The light block ends with --pm-inverse-primary
  c = c.replace(
    '  --pm-inverse-primary:       #818cf8;\n}',
    '  --pm-inverse-primary:       #818cf8;\n' + lightTokens + '}'
  );
  console.log('Added Signature Artifact tokens (light)');
}

// ─────────────────────────────────────────────────────────
// 4. Append focus ring styles (Phase A) if not present
// ─────────────────────────────────────────────────────────
if (!c.includes('input:focus')) {
  c += `
/* Form Focus Rings (No Glow, Soft Cyan) */
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: transparent !important;
  box-shadow: 0 0 0 2px var(--pm-cyan) !important;
}
`;
  console.log('Added focus ring styles');
}

fs.writeFileSync('src/index.css', c);
console.log('All tokens applied successfully.');
