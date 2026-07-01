const fs = require('fs');

// MEMBER DIRECTORY
let md = fs.readFileSync('c:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/components/team/MemberDirectory.tsx', 'utf8');
md = md.replace('export function MemberDirectory() {', 'export function MemberDirectory({ teamId }: { teamId?: string }) {');

const replaceStr = `  const userCustomRoles = systemData.userCustomRoles || {};
  let activeProfiles = profiles.filter(p => p.status === 'active' && p.role !== 'uninvited');

  if (teamId) {
    const team = useDashboard().teams.find(t => t.id === teamId);
    if (team) {
      const pmId = (team.data as any)?.pm_id;
      const devIds = (team.data as any)?.developer_ids || [];
      const allTeamIds = [...devIds];
      if (pmId && !allTeamIds.includes(pmId)) allTeamIds.push(pmId);
      activeProfiles = activeProfiles.filter(p => allTeamIds.includes(p.id));
    } else {
      activeProfiles = [];
    }
  }`;
md = md.replace("  const userCustomRoles = systemData.userCustomRoles || {};\n  const activeProfiles = profiles.filter(p => p.status === 'active' && p.role !== 'uninvited');", replaceStr);
fs.writeFileSync('c:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/components/team/MemberDirectory.tsx', md, 'utf8');

// SKILLS MATRIX
let sm = fs.readFileSync('c:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/components/resources/SkillsMatrixView.tsx', 'utf8');
sm = sm.replace('export function SkillsMatrixView() {', 'export function SkillsMatrixView({ teamId }: { teamId?: string }) {');
sm = sm.replace('const { raw: { skills = [], userSkills = [], profiles = [] } } = useOperationalData();', 'const { raw: { skills = [], userSkills = [], profiles: allProfiles = [], teams = [] } } = useOperationalData();');
const smReplaceStr = `
  let profiles = allProfiles;
  if (teamId) {
    const team = teams.find(t => t.id === teamId);
    if (team) {
      const pmId = (team.data as any)?.pm_id;
      const devIds = (team.data as any)?.developer_ids || [];
      const allTeamIds = [...devIds];
      if (pmId && !allTeamIds.includes(pmId)) allTeamIds.push(pmId);
      profiles = profiles.filter(p => allTeamIds.includes(p.id));
    } else {
      profiles = [];
    }
  }
`;
sm = sm.replace("  const canManageTeam = hasCapability(profile?.role, 'people.manage');", "  const canManageTeam = hasCapability(profile?.role, 'people.manage');" + smReplaceStr);
fs.writeFileSync('c:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/components/resources/SkillsMatrixView.tsx', sm, 'utf8');

console.log('Successfully added teamId filtering');
