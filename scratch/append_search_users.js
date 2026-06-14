const fs = require('fs');
const path = require('path');

const filePath = path.resolve('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/services/operationalDataService.ts');
let content = fs.readFileSync(filePath, 'utf8');

const newMethod = `
/**
 * Search active workspace users (Batch 6C Scale Architecture)
 * Uses RPC to prevent downloading all users to the client.
 */
export async function searchWorkspaceUsers(workspaceId: string, searchText: string, limit: number = 20): Promise<Profile[]> {
  const { data, error } = await supabase.rpc('search_workspace_users', {
    p_workspace_id: workspaceId,
    p_search_text: searchText,
    p_limit: limit
  });
  if (error) {
    console.error('[searchWorkspaceUsers] Error:', error);
    return [];
  }
  return (data || []) as Profile[];
}
`;

if (!content.includes('searchWorkspaceUsers')) {
    fs.appendFileSync(filePath, newMethod);
    console.log('Appended searchWorkspaceUsers successfully.');
} else {
    console.log('searchWorkspaceUsers already exists.');
}
