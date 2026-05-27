from pathlib import Path
import re, urllib.request

roots = [Path('/var/www/unicorn/UNICORN_FINAL/.env'), Path('/var/www/unicorn/shared/.env'), Path('/var/www/unicorn')]
key_re = re.compile(r'^(GITHUB_TOKEN|GH_PAT|GH_TOKEN|GITHUB_TOKEN_SYNC)=(.*)$')
pat_re = re.compile(r'(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})')

cands = []
seen = set()
for root in roots:
    if not root.exists():
        continue
    if root.is_file():
        files = [root]
    else:
        files = [p for p in root.rglob('.env')][:2000]
    for p in files:
        try:
            txt = p.read_text(errors='ignore')
        except Exception:
            continue
        for ln in txt.splitlines():
            m = key_re.match(ln.strip())
            if not m:
                continue
            k, v = m.group(1), m.group(2).strip()
            pm = pat_re.search(v)
            if not pm:
                continue
            token = pm.group(1)
            if token in seen:
                continue
            seen.add(token)
            cands.append((str(p), k, token))

print('candidate_tokens=' + str(len(cands)))
valid = None
for src, k, token in cands:
    req = urllib.request.Request('https://api.github.com/user', headers={
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'zeus-token-recovery'
    })
    code = 0
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            code = r.getcode()
    except Exception as e:
        s = str(e)
        m = re.search(r'HTTP Error (\d+)', s)
        code = int(m.group(1)) if m else 0
    print(f'test {k} from {src} -> http={code} token_len={len(token)}')
    if code == 200 and valid is None:
        valid = token

if valid:
    envp = Path('/var/www/unicorn/UNICORN_FINAL/.env')
    lines = [ln for ln in envp.read_text().splitlines() if not ln.startswith('GITHUB_TOKEN=')]
    lines.append('GITHUB_TOKEN=' + valid)
    envp.write_text('\n'.join(lines) + '\n')
    print('SET_GITHUB_TOKEN=1')
else:
    print('SET_GITHUB_TOKEN=0')