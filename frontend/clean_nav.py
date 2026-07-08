import os
import re

base_dir = r'c:\Users\jithi\OneDrive\Desktop\Resolve PM\Resolve PM\frontend\src'
files = []

for root, _, fs in os.walk(base_dir):
    for f in fs:
        if f.endswith('.ts') or f.endswith('.tsx'):
            files.append(os.path.join(root, f))

def get_matching_brace_index(s, start_idx):
    count = 0
    for i in range(start_idx, len(s)):
        if s[i] == '{':
            count += 1
        elif s[i] == '}':
            count -= 1
            if count == 0:
                return i
    return -1

for filepath in files:
    if 'core\\auth\\postAuthRedirect.ts' in filepath or 'core/auth/postAuthRedirect.ts' in filepath:
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # 1. Remove `function navigateTo`
    while True:
        match = re.search(r'function navigateTo\([^)]*\)\s*\{', content)
        if not match:
            break
        start_idx = match.end() - 1
        end_idx = get_matching_brace_index(content, start_idx)
        if end_idx != -1:
            content = content[:match.start()] + content[end_idx+1:]
        else:
            break

    # 2. Remove `const navigateTo =`
    while True:
        match = re.search(r'(?:const|let|var)\s+navigateTo\s*=\s*(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>\s*\{', content)
        if not match:
            break
        start_idx = match.end() - 1
        end_idx = get_matching_brace_index(content, start_idx)
        if end_idx != -1:
            # Check for trailing semicolon
            if end_idx + 1 < len(content) and content[end_idx+1] == ';':
                end_idx += 1
            content = content[:match.start()] + content[end_idx+1:]
        else:
            break

    # 3. Replace calls
    content = re.sub(r'\bnavigateTo\(', 'navigate(', content)
    
    # 4. Remove redundant imports
    content = re.sub(r'import\s+\{[^}]*\bnavigateTo\b[^}]*\}\s+from\s+[^;]+;', lambda m: m.group(0).replace('navigateTo,', '').replace(', navigateTo', '').replace('navigateTo', ''), content)
    content = re.sub(r'import\s+\{\s*\}\s+from\s+[^;]+;\n?', '', content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Cleaned navigateTo from', filepath)
