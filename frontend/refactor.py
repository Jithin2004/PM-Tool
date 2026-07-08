import os
import re

files_to_update = [
    r"src\pages\onboarding\AcceptInvitePage.tsx",
    r"src\pages\onboarding\WorkspaceSetupWizard.tsx",
    r"src\pages\dashboard\ClientDeliveryPortal.tsx",
    r"src\pages\dashboard\DashboardLayout.tsx",
    r"src\components\auth\Login.tsx",
    r"src\components\auth\ResetPassword.tsx",
    r"src\components\finance\CreateInvoiceModal.tsx",
    r"src\components\ui\ErrorBoundary.tsx",
    r"src\components\workspace\GettingStartedHub.tsx",
    r"src\components\workspace\SandboxWorkspaceManager.tsx",
    r"src\components\control\BillingSettings.tsx",
    r"src\components\auth\PasswordSetup.tsx",
    r"src\components\error\AppErrorBoundary.tsx",
    r"src\components\auth\ClientPortalLogin.tsx",
    r"src\components\client\ClientDashboard.tsx",
]

base_dir = r"c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend"

for rel_path in files_to_update:
    filepath = os.path.join(base_dir, rel_path)
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Calculate relative path to src/lib/navigation.ts
    # src/pages/onboarding/... -> ../../lib/navigation
    depth = rel_path.count('\\') - 1
    import_path = '../' * depth + 'lib/navigation'
    if depth == 0:
        import_path = './lib/navigation'

    needs_import = False
    needs_navigate = False
    needs_reload = False

    # Replace window.location.href = ...
    # We match: window.location.href = X
    # X can be a backtick string, single quote string, double quote string, or a variable.
    href_pattern = re.compile(r'window\.location\.href\s*=\s*(.+?);', re.DOTALL)
    
    def repl_href(m):
        global needs_navigate
        needs_navigate = True
        return f"navigate({m.group(1)});"
    
    # Check if there are matches
    if href_pattern.search(content):
        content = href_pattern.sub(repl_href, content)

    # Replace window.location.href in one-liners without semicolon like arrow functions
    # e.g., () => window.location.href = '...'
    href_pattern2 = re.compile(r'window\.location\.href\s*=\s*([^;}]+?)(?=[;}\n])')
    def repl_href2(m):
        global needs_navigate
        needs_navigate = True
        return f"navigate({m.group(1)})"
    
    if href_pattern2.search(content):
        content = href_pattern2.sub(repl_href2, content)
        
    # Replace window.location.reload()
    reload_pattern = re.compile(r'window\.location\.reload\(\)')
    if reload_pattern.search(content):
        needs_reload = True
        content = reload_pattern.sub("reload()", content)

    if (needs_navigate or needs_reload) and content != original_content:
        imports = []
        if needs_navigate: imports.append('navigate')
        if needs_reload: imports.append('reload')
        import_stmt = f"import {{ {', '.join(imports)} }} from '{import_path}';\n"
        
        # Add import at the top after React imports
        # Find last import statement
        lines = content.split('\n')
        last_import_idx = 0
        for i, line in enumerate(lines):
            if line.startswith('import '):
                last_import_idx = i
        
        lines.insert(last_import_idx + 1, import_stmt)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        print(f"Updated: {rel_path}")
