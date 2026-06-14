const fs = require('fs');
const path = require('path');

const filePath = path.resolve('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/services/dailyCommandService.ts');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `  if (m.approvals > 0) {
    i.upcomingDeadlines.push({
      id: 'pm-approvals',
      title: 'Pending Approvals',
      subtitle: \`\${m.approvals} approvals require your sign-off.\`,
      priority: 'Normal',
      actionLabel: 'Review',
      actionRoute: '/overview'
    });
  }`;

const appendStr = `\n\n  if (m.recent_changes > 0) {
    i.recentChanges.push({
      id: 'recent-pm',
      description: \`\${m.recent_changes} tasks or projects updated recently.\`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  }

  if (m.waiting_on_me > 0) {
    i.upcomingDeadlines.push({
      id: 'wait-states',
      title: 'Wait States',
      subtitle: \`\${m.waiting_on_me} items are waiting on you.\`,
      priority: 'High',
      actionLabel: 'Review',
      actionRoute: '/board'
    });
  }`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, targetStr + appendStr);
    fs.writeFileSync(filePath, content);
    console.log("Updated populatePMIntelligence successfully.");
} else {
    console.log("Could not find target string in populatePMIntelligence.");
}
