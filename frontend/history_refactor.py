import os
import re

base_dir = r"c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend\src"

def process_file(filepath):
    if not os.path.isfile(filepath): return False
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    needs_navigate = False
    needs_replace = False

    # Skip the actual implementations
    if "lib\\navigation.ts" in filepath or "lib/navigation.ts" in filepath:
        return False
    if "app\\router.tsx" in filepath or "app/router.tsx" in filepath:
        return False
    if "core\\auth\\postAuthRedirect.ts" in filepath or "core/auth/postAuthRedirect.ts" in filepath:
        # Actually we should refactor postAuthRedirect too, but let's be careful.
        pass

    # Replace window.history.pushState(..., '', X) with navigate(X)
    # We'll use a regex that handles window.history.pushState(null, '', path)
    push_pattern = re.compile(r'window\.history\.pushState\(\s*[^,]+,\s*[^,]+,\s*([^)]+)\)\s*;?')
    def push_repl(m):
        nonlocal needs_navigate
        needs_navigate = True
        return f"navigate({m.group(1)});"
    
    content, count_push = push_pattern.subn(push_repl, content)

    # Replace window.history.replaceState(..., '', X) with replace(X)
    replace_pattern = re.compile(r'window\.history\.replaceState\(\s*[^,]+,\s*[^,]+,\s*([^)]+)\)\s*;?')
    def replace_repl(m):
        nonlocal needs_replace
        needs_replace = True
        return f"replace({m.group(1)});"
    
    content, count_replace = replace_pattern.subn(replace_repl, content)

    # Remove redundant window.dispatchEvent(new CustomEvent('popstate')) if right after navigate or replace
    # because navigate/replace already dispatch it.
    dispatch_pattern = re.compile(r'(navigate\([^)]+\);|replace\([^)]+\);)\s*window\.dispatchEvent\(new (?:CustomEvent|Event|PopStateEvent)\((?:[\'"]popstate[\'"](?:,\s*\{[^}]*\})?)\)\);?')
    content = dispatch_pattern.sub(r'\1', content)

    if (needs_navigate or needs_replace) and content != original_content:
        # calculate import path
        rel_path = os.path.relpath(filepath, base_dir)
        depth = rel_path.count(os.sep)
        import_path = '../' * depth + 'lib/navigation'
        if depth == 0:
            import_path = './lib/navigation'
        import_path = import_path.replace('\\', '/')

        imports = []
        if needs_navigate: imports.append('navigate')
        if needs_replace: imports.append('replace')
        import_stmt = f"import {{ {', '.join(imports)} }} from '{import_path}';\n"
        
        # Insert import after the last import line
        lines = content.split('\n')
        last_import = 0
        for i, line in enumerate(lines):
            if line.startswith('import '):
                last_import = i
        lines.insert(last_import + 1, import_stmt)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        print(f"Updated {rel_path}")
        return True
    return False

for root, _, files in os.walk(base_dir):
    for f in files:
        if f.endswith('.ts') or f.endswith('.tsx'):
            process_file(os.path.join(root, f))
