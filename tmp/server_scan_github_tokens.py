from pathlib import Path
import re

roots = [Path('/var/www/unicorn'), Path('/root'), Path('/etc')]
key_re = re.compile(r'^(GITHUB_TOKEN|GH_PAT|GH_TOKEN|GITHUB_TOKEN_SYNC)=(.*)$')
real_re = re.compile(r'(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})')

results = []
for root in roots:
    if not root.exists():
        continue
    for p in root.rglob('*'):
        if not p.is_file():
            continue
        name = p.name.lower()
        if not (name.startswith('.env') or 'secret' in name or 'token' in name or name.endswith('.service')):
            continue
        try:
            txt = p.read_text(errors='ignore')
        except Exception:
            continue
        for ln in txt.splitlines():
            m = key_re.match(ln.strip())
            if not m:
                continue
            k, v = m.group(1), m.group(2).strip()
            placeholder = ('YOUR_PERSONAL_ACCESS_TOKEN_HERE' in v) or (v == '')
            real_like = bool(real_re.search(v)) and not placeholder
            results.append((str(p), k, len(v), int(placeholder), int(real_like)))

print('matches=' + str(len(results)))
for row in results[:300]:
    print(f'{row[0]} :: {row[1]} len={row[2]} placeholder={row[3]} real_like={row[4]}')