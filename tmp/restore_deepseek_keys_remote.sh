#!/usr/bin/env bash
set -euo pipefail
SRC=/var/www/unicorn/UNICORN_FINAL.prelink.1777753316/.env
DST=/var/www/unicorn/UNICORN_FINAL/.env
python3 - <<'PY'
from pathlib import Path
src=Path('/var/www/unicorn/UNICORN_FINAL.prelink.1777753316/.env')
dst=Path('/var/www/unicorn/UNICORN_FINAL/.env')
if not src.exists() or not dst.exists():
    print('missing_env_file')
    raise SystemExit(0)

def parse_env(path):
    out={}
    for line in path.read_text(encoding='utf-8',errors='ignore').splitlines():
        if not line or line.lstrip().startswith('#') or '=' not in line:
            continue
        k,v=line.split('=',1)
        k=k.strip(); v=v.strip()
        if len(v)>=2 and ((v[0]==v[-1]=='"') or (v[0]==v[-1]=="'")):
            v=v[1:-1]
        out[k]=v
    return out

src_env=parse_env(src)
dst_lines=dst.read_text(encoding='utf-8',errors='ignore').splitlines()
set_map={
    'DEEPSEEK_API_KEY':src_env.get('DEEPSEEK_API_KEY',''),
    'OPENROUTER_API_KEY':src_env.get('OPENROUTER_API_KEY',''),
    'GROQ_API_KEY':src_env.get('GROQ_API_KEY',''),
    'DEEPSEEK_LOOP_ENABLED':'1',
    'DEEPSEEK_LOOP_EXECUTE':'1',
}
set_map={k:v for k,v in set_map.items() if v}

new=[]
seen=set()
for line in dst_lines:
    if '=' in line and not line.lstrip().startswith('#'):
        k=line.split('=',1)[0].strip()
        if k in set_map:
            new.append(f'{k}={set_map[k]}')
            seen.add(k)
            continue
    new.append(line)
for k,v in set_map.items():
    if k not in seen:
        new.append(f'{k}={v}')

dst.write_text('\n'.join(new).rstrip()+'\n',encoding='utf-8')
cur=parse_env(dst)
for k in ['DEEPSEEK_API_KEY','OPENROUTER_API_KEY','GROQ_API_KEY','DEEPSEEK_LOOP_ENABLED','DEEPSEEK_LOOP_EXECUTE']:
    v=cur.get(k,'')
    if k.startswith('DEEPSEEK_LOOP_'):
        print(f'{k}={v}')
    else:
        print(f'{k} len={len(v)}')
PY
