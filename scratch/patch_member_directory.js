const fs = require('fs');
const path = require('path');

const filePath = path.resolve('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/components/team/MemberDirectory.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes("import { UserSearchSelect }")) {
    content = content.replace("import { ExitHandoffEngine, HandoffAuditReport } from '../../core/system/ExitHandoffEngine';", "import { ExitHandoffEngine, HandoffAuditReport } from '../../core/system/ExitHandoffEngine';\nimport { UserSearchSelect } from './UserSearchSelect';");
}

const targetSelect = `<select
                      value={handoffState.transferToUserId}
                      onChange={(e) => setHandoffState(prev => ({ ...prev, transferToUserId: e.target.value }))}
                      className="w-full bg-black/40 border border-[var(--border-soft)] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="" className="bg-[#1f2937]">-- Choose Teammate --</option>
                      {activeProfiles
                        .filter(p => p.id !== selectedMemberDetails.id)
                        .map(p => (
                          <option key={p.id} value={p.id} className="bg-[#1f2937]">
                            {p.full_name || p.email} ({p.role})
                          </option>
                        ))}
                    </select>`;

const newSelect = `<UserSearchSelect 
                      value={handoffState.transferToUserId} 
                      onChange={(id) => setHandoffState(prev => ({ ...prev, transferToUserId: id }))} 
                      excludeUserId={selectedMemberDetails.id}
                    />`;

if (content.includes('select\n                      value={handoffState.transferToUserId}')) {
    // If exact replace fails, do a regex replace or just targeted substring replacement
    // The indentation might be slightly different so regex is safer.
    content = content.replace(/<select[\s\S]*?value=\{handoffState\.transferToUserId\}[\s\S]*?<\/select>/, newSelect);
    fs.writeFileSync(filePath, content);
    console.log("Patched MemberDirectory.tsx successfully.");
} else {
    console.log("Target select not found in MemberDirectory.tsx");
}
