const fs = require('fs');

function replaceFile(path, replacer) {
  if (fs.existsSync(path)) {
    const orig = fs.readFileSync(path, 'utf8');
    const modified = replacer(orig);
    if (orig !== modified) {
      fs.writeFileSync(path, modified);
      console.log(`Modified ${path}`);
    } else {
      console.log(`No change in ${path}`);
    }
  } else {
    console.log(`Not found ${path}`);
  }
}

// 1. LogisticsDashboard.tsx
replaceFile('src/components/admin/LogisticsDashboard.tsx', (content) => {
  // Remove overflow from tabs (let flex wrap handle it)
  content = content.replace(/flex overflow-x-auto scrollbar-none/g, 'flex flex-wrap gap-2');
  // Remove min-w-[1000px] from the table
  content = content.replace(/min-w-\[1000px\]/g, '');
  // Remove overflow-x-auto from the table wrapper so it doesn't trigger parent scroll
  content = content.replace(/<div className="overflow-x-auto">/g, '<div>');
  return content;
});

// 2. TeamRosterView.tsx
replaceFile('src/components/resources/TeamRosterView.tsx', (content) => {
  // Remove overflow-x-auto from the wrapper
  content = content.replace(/<div className="overflow-x-auto">/g, '<div>');
  return content;
});

// 3. CalendarIntelligencePanel.tsx
replaceFile('src/components/admin/CalendarIntelligencePanel.tsx', (content) => {
  content = content.replace(/<div className="overflow-x-auto">/g, '<div>');
  content = content.replace(/min-w-\[600px\]/g, '');
  return content;
});

// 4. WorkspaceSetupWizard.tsx
replaceFile('src/pages/onboarding/WorkspaceSetupWizard.tsx', (content) => {
  content = content.replace(/overflow-x-auto whitespace-nowrap scrollbar-hide/g, 'flex-wrap');
  // the text truncation with max-w-[200px] is okay, but let's change it to responsive
  content = content.replace(/max-w-\[200px\]/g, 'max-w-[150px] md:max-w-[200px]');
  return content;
});
