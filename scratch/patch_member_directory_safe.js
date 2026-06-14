const fs = require('fs');
const path = require('path');

const filePath = path.resolve('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/src/components/team/MemberDirectory.tsx');
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/\r\n/g, '\n');

if (!content.includes("import { UserSearchSelect }")) {
    content = content.replace("import { ExitHandoffEngine, HandoffAuditReport } from '../../core/system/ExitHandoffEngine';", "import { ExitHandoffEngine, HandoffAuditReport } from '../../core/system/ExitHandoffEngine';\nimport { UserSearchSelect } from './UserSearchSelect';");
}

const targetStart = `<select\n                      value={handoffState.transferToUserId}`;
const targetIndex = content.indexOf(targetStart);
if (targetIndex !== -1) {
    const endSelectTag = `</select>`;
    const endIndex = content.indexOf(endSelectTag, targetIndex) + endSelectTag.length;
    
    if (endIndex > targetIndex) {
        const toReplace = content.substring(targetIndex, endIndex);
        const newSelect = `<UserSearchSelect \n                      value={handoffState.transferToUserId} \n                      onChange={(id) => setHandoffState(prev => ({ ...prev, transferToUserId: id }))} \n                      excludeUserId={selectedMemberDetails.id}\n                    />`;
        
        content = content.replace(toReplace, newSelect);
        content = content.replace(/\n/g, '\r\n');
        fs.writeFileSync(filePath, content);
        console.log("Patched MemberDirectory.tsx securely.");
    }
} else {
    console.log("Target select not found.");
}
