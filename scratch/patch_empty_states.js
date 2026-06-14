const fs = require('fs');
const path = require('path');

// 1. TeamsPage.tsx
const teamsPath = path.resolve('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/pages/resources/TeamsPage.tsx');
let teamsContent = fs.readFileSync(teamsPath, 'utf8');

if (!teamsContent.includes('activeProfiles.length === 0')) {
  // We need to inject the activeProfiles logic or we can just patch MemberDirectory directly
  const memberDirPath = path.resolve('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/components/team/MemberDirectory.tsx');
  let mdContent = fs.readFileSync(memberDirPath, 'utf8');
  if (!mdContent.includes('PremiumEmptyState')) {
    mdContent = mdContent.replace("import { UserSearchSelect } from './UserSearchSelect';", "import { UserSearchSelect } from './UserSearchSelect';\nimport { PremiumEmptyState } from '../ui/PremiumEmptyState';\nimport { Users } from 'lucide-react';");
    const replacement = `const activeProfiles = profiles.filter(p => p.role !== 'uninvited');

  if (activeProfiles.length === 0) {
    return (
      <PremiumEmptyState 
        icon={Users}
        title="No Team Members Found"
        description="Your team directory is currently empty. Invite members to your workspace to start assigning tasks and planning capacity."
        action={null}
      />
    );
  }

  return (`;
    mdContent = mdContent.replace(`const activeProfiles = profiles.filter(p => p.role !== 'uninvited');\n\n  return (`, replacement);
    fs.writeFileSync(memberDirPath, mdContent);
    console.log('Patched MemberDirectory.tsx');
  }
}

// 2. SprintPage.tsx
const sprintPath = path.resolve('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/pages/execution/SprintPage.tsx');
let sprintContent = fs.readFileSync(sprintPath, 'utf8');
if (!sprintContent.includes('PremiumEmptyState')) {
  sprintContent = sprintContent.replace("import { ExecutionSystem } from '../../components/execution/system/ExecutionSystem';", "import { ExecutionSystem } from '../../components/execution/system/ExecutionSystem';\nimport { PremiumEmptyState } from '../../components/ui/PremiumEmptyState';\nimport { Layers } from 'lucide-react';");
  
  const replacement = `      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12 glass-panel rounded-xl border border-border h-[calc(100vh-180px)] overflow-hidden bg-surface-2">
          {projects.length === 0 ? (
             <PremiumEmptyState 
               icon={Layers}
               title="No Active Sprints"
               description="You need at least one project to start planning sprints and executing tasks. Create a project in the workspace to begin."
             />
          ) : (
            <ExecutionSystem
              projects={projects}
              users={profiles}
              currentUserProfile={profile}
              notify={notify}
              onRecalibrateAnalytics={() => fetchProjects()}
              initialView="sprint"
            />
          )}
        </div>
      </div>`;
  sprintContent = sprintContent.replace(/<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">[\s\S]*?<\/div>\n      <\/div>/, replacement);
  fs.writeFileSync(sprintPath, sprintContent);
  console.log('Patched SprintPage.tsx');
}

// 3. ReportsCenter.tsx
const reportsPath = path.resolve('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/pages/workspace/ReportsCenter.tsx');
let reportsContent = fs.readFileSync(reportsPath, 'utf8');
if (!reportsContent.includes('PremiumEmptyState')) {
  reportsContent = reportsContent.replace("import { Download, RefreshCw, BarChart2, PieChart as PieChartIcon, TrendingUp, Calendar } from 'lucide-react';", "import { Download, RefreshCw, BarChart2, PieChart as PieChartIcon, TrendingUp, Calendar, FileText } from 'lucide-react';\nimport { PremiumEmptyState } from '../../components/ui/PremiumEmptyState';");
  
  const replacement = `      <div className="flex flex-col lg:flex-row gap-6 mt-6">
        {projects.length === 0 ? (
          <div className="w-full">
            <PremiumEmptyState 
              icon={FileText}
              title="No Data for Reports"
              description="Reports will be automatically generated once you have active projects, tasks, and team activity."
            />
          </div>
        ) : (
          <>
            {/* Left Column: Report Builder */}`;

  reportsContent = reportsContent.replace("{/* Left Column: Report Builder */", replacement);
  reportsContent = reportsContent.replace("{/* Right Column: Recent Exports */", "</>\n        )}\n\n        {/* Right Column: Recent Exports */");

  // Since it's a bit hard to regex replace JSX perfectly, I'll just write it manually if this string exists
  if(reportsContent.includes('Reports will be automatically generated')) {
      // it means success
      fs.writeFileSync(reportsPath, reportsContent);
      console.log('Patched ReportsCenter.tsx');
  } else {
     // manual fallback
     console.log('Failed to patch ReportsCenter.tsx automatically, needs manual regex');
  }
}
