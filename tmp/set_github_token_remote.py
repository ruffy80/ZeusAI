from pathlib import Path
import base64

env_path = Path('/var/www/unicorn/UNICORN_FINAL/.env')
b64_path = Path('/tmp/gh_token.b64')
if not b64_path.exists():
    print('REMOTE_B64_MISSING')
    raise SystemExit(1)
token = base64.b64decode(b64_path.read_text().strip()).decode('utf-8', 'ignore').strip()
if not token:
    print('REMOTE_TOKEN_EMPTY')
    raise SystemExit(1)
text = env_path.read_text() if env_path.exists() else ''
lines = [ln for ln in text.splitlines() if not ln.startswith('GITHUB_TOKEN=')]
lines.append('GITHUB_TOKEN=' + token)
env_path.write_text('\n'.join(lines) + '\n')
b64_path.unlink(missing_ok=True)
print('GITHUB_TOKEN_SET len=' + str(len(token)))