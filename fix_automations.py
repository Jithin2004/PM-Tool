with open('frontend/src/pages/dashboard/AutomationsPanel.tsx', 'r') as f:
    content = f.read()

import re

# Update installTemplate signature call in AutomationsPanel
content = content.replace('installTemplate(wsId, t, profile?.id)', 'installTemplate(t, wsId)')

with open('frontend/src/pages/dashboard/AutomationsPanel.tsx', 'w') as f:
    f.write(content)

print("Fixed AutomationsPanel")
