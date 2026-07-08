import os
import re

files = [
    r'c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend\src\components\calendar\CalendarView.tsx',
    r'c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend\src\components\control\WorkspaceHealth.tsx',
    r'c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend\src\components\dashboard\ContinuityPanel.tsx',
    r'c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend\src\components\inbox\ActionInbox.tsx',
    r'c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend\src\components\onboarding\WelcomeCenter.tsx',
    r'c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend\src\components\overview\DailyCommandCenter.tsx',
    r'c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend\src\components\overview\RoleAwareQuickAccess.tsx',
    r'c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend\src\landing\LandingPage.tsx',
    r'c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend\src\pages\dashboard\DashboardLayout.tsx',
    r'c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend\src\pages\mission-control\MissionControlPage.tsx',
    r'c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend\src\pages\onboarding\WorkspaceSetupWizard.tsx',
    r'c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend\src\pages\resources\TeamsPage.tsx',
    r'c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend\src\pages\setup\ExecutionSetupPage.tsx'
]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Just auto-inject it properly if it's missing
    has_navigate_import = re.search(r'import\s+.*?\bnavigate\b.*?\s+from\s+[\'\"].*?navigation[\'\"]', content)
    if 'navigate(' in content and not has_navigate_import:
        # Calculate import path
        rel = os.path.relpath(filepath, r'c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend\src')
        depth = rel.count(os.sep)
        path = '../' * depth + 'lib/navigation'
        if depth == 0: path = './lib/navigation'
        path = path.replace('\\', '/')
        
        # Check if replace or reload is already imported
        existing_nav = re.search(r'import\s+\{([^}]+)\}\s+from\s+[\'\"](?:.*?)/lib/navigation[\'\"];?', content)
        if existing_nav:
            # Add to existing
            imports = [i.strip() for i in existing_nav.group(1).split(',')]
            if 'navigate' not in imports:
                imports.append('navigate')
                content = content.replace(existing_nav.group(0), f'import {{ {", ".join(imports)} }} from \'{path}\';')
        else:
            # Insert after last import
            lines = content.split('\n')
            last = 0
            for i, l in enumerate(lines):
                if l.startswith('import '):
                    last = i
            lines.insert(last + 1, f'import {{ navigate }} from \'{path}\';')
            content = '\n'.join(lines)
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Injected navigate import to', filepath)
