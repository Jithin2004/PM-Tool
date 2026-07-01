const fs = require('fs');

let page = fs.readFileSync('c:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/pages/company/OperationalTeamsPage.tsx', 'utf8');

// Ensure OperationalTeamsPage imports handleDeleteTeam if it's there
// `useDashboard` should return `handleDeleteTeam`, `handleUpdateTeam`
page = page.replace(
  'const { teams, profiles, projects, tasks, handleCreateTeam } = useDashboard();',
  'const { teams, profiles, projects, tasks, handleCreateTeam, handleDeleteTeam } = useDashboard();'
);

page = page.replace(
  "Create your first team to organize employees, assign ownership, monitor workload, and unlock capacity analytics.",
  "Teams are the foundation of operational delivery. Creating teams allows you to assign project ownership, monitor collective capacity, and maintain clear departmental structures across your organization."
);

if (!page.includes('const [editingTeam, setEditingTeam]')) {
  page = page.replace(
    'const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);',
    'const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);\n  const [editingTeam, setEditingTeam] = useState<any>(null);'
  );
}

page = page.replace(
  "onDuplicate={(e) => { e.stopPropagation(); /* TODO: duplicate */ }}",
  "onDuplicate={async (e) => { e.stopPropagation(); await handleCreateTeam(`${team.name} (Copy)`, pm?.id || '', [], data); }}"
);

page = page.replace(
  "onDelete={(e) => { e.stopPropagation(); /* TODO: delete */ }}",
  "onDelete={async (e) => { e.stopPropagation(); if(confirm('Are you sure you want to delete this team?')) { await handleDeleteTeam(team.id); } }}"
);

page = page.replace(
  "onEdit={(e) => { e.stopPropagation(); /* TODO: edit */ }}",
  "onEdit={(e) => { e.stopPropagation(); setEditingTeam(team); }}"
);

// add modal for editing:
if (!page.includes('editingTeam={editingTeam}')) {
  page = page.replace(
    '<CreateTeamModal\n          onClose={() => setIsCreateModalOpen(false)}\n          onSubmit={handleCreateTeam}\n          profiles={profiles}\n        />',
    '<CreateTeamModal\n          onClose={() => setIsCreateModalOpen(false)}\n          onSubmit={handleCreateTeam}\n          profiles={profiles}\n        />\n      )}\n      {editingTeam && (\n        <CreateTeamModal\n          editingTeam={editingTeam}\n          onClose={() => setEditingTeam(null)}\n          onSubmit={handleCreateTeam} // Note: CreateTeamModal will handle update logic if editingTeam is passed\n          profiles={profiles}\n        />'
  );
}

fs.writeFileSync('c:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/pages/company/OperationalTeamsPage.tsx', page, 'utf8');
console.log('Updated OperationalTeamsPage');
