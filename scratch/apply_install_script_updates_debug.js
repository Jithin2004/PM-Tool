const fs = require('fs');
const path = require('path');

const filePath = path.resolve('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/database/production/RESOLVE_PM_V1_3_INSTALL.sql');
let content = fs.readFileSync(filePath, 'utf8');

function replaceStr(target, replacement, desc) {
    if (!content.includes(target)) {
        console.log('FAILED to find target: ' + desc);
        // Debug first 100 chars of target
        console.log('Target starts with: ' + target.substring(0, 50).replace(/\n/g, '\\n'));
    } else {
        content = content.replace(target, replacement);
        console.log('Success: ' + desc);
    }
}

const target1 = `  SELECT workspace_id FROM users WHERE id = auth.uid() LIMIT 1
$$;`;
const replacement1 = `  SELECT workspace_id FROM users WHERE id = auth.uid() LIMIT 1
$$;

-- Returns true if the currently authenticated user is an active workspace member.
CREATE OR REPLACE FUNCTION public.is_active_workspace_member()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = auth.uid() 
      AND workspace_id = current_workspace() 
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';`;
replaceStr(target1, replacement1, 'Add is_active_workspace_member');

const target2 = `  mime_type     text,
  size_bytes    bigint,`;
const replacement2 = `  mime_type     text,
  size_bytes    bigint,
  is_internal   boolean     NOT NULL DEFAULT true,`;
replaceStr(target2, replacement2, 'Add is_internal to files');

fs.writeFileSync(filePath, content);
