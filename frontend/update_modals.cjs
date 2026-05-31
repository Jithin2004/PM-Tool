const fs = require('fs');
const path = require('path');

const files = [
  'src/components/navigation/CommandPalette.tsx',
  'src/components/ui/ConfirmationModal.tsx',
  'src/components/user/UserProfileModal.tsx',
  'src/components/team/TeamRosterModal.tsx',
  'src/components/project/ProjectDetailsModal.tsx',
  'src/components/meetings/MeetingScheduler.tsx'
];

files.forEach(f => {
  const fullPath = path.join(__dirname, f);
  if (fs.existsSync(fullPath)) {
    let c = fs.readFileSync(fullPath, 'utf8');
    
    // Safely target the modal panel container classes
    c = c.replace(/className="([^"]*)bg-surface-elevated([^"]*)"/g, 'className="$1bg-[var(--pm-panel)]$2"');
    c = c.replace(/className="([^"]*)bg-surface-2([^"]*)"/g, 'className="$1bg-[var(--pm-panel)]$2"');
    c = c.replace(/className=\{`([^`]*)bg-surface-elevated([^`]*)`\}/g, 'className={`$1bg-[var(--pm-panel)]$2`}');
    c = c.replace(/className=\{`([^`]*)bg-surface-2([^`]*)`\}/g, 'className={`$1bg-[var(--pm-panel)]$2`}');
    c = c.replace(/className="([^"]*)bg-\[var\(--pm-surface-elevated\)]([^"]*)"/g, 'className="$1bg-[var(--pm-panel)]$2"');

    // For CommandPalette, it might use bg-surface
    if (f.includes('CommandPalette.tsx')) {
        c = c.replace(/bg-surface/g, 'bg-[var(--pm-panel)]');
    }

    fs.writeFileSync(fullPath, c);
    console.log('Updated:', f);
  }
});
