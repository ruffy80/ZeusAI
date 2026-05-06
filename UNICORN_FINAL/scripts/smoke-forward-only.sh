#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
PUBLIC_URL="${PUBLIC_URL:-https://zeusai.pro}"
EXPECT_PM2_CWD="${EXPECT_PM2_CWD:-}"
SKIP_PUBLIC="${SKIP_PUBLIC:-0}"
REQUIRE_PM2="${REQUIRE_PM2:-0}"

json_get() {
  local url="$1"
  curl -fsS --max-time 15 -H 'Cache-Control: no-cache' "$url"
}

assert_node_json() {
  local label="$1"
  local url="$2"
  local js="$3"
  local body
  body="$(json_get "$url")"
  node -e "const data=JSON.parse(process.argv[1]); ${js}" "$body"
  echo "✅ $label"
}

echo "[smoke-forward-only] base=$BASE_URL public=$PUBLIC_URL"

assert_node_json "backend health status ok" "$BASE_URL/health" \
  "if (!((data.status === 'ok' || data.ok === true) && data.dbConnected !== false)) process.exit(1);"

assert_node_json "backend engines active" "$BASE_URL/health" \
  "if (data.engines && !Object.values(data.engines).every(Boolean)) process.exit(1);"

assert_node_json "quantum integrity intact" "$BASE_URL/api/quantum-integrity/status" \
  "if (!(data.active === true && data.integrity === 'intact' && (!data.diagnostics || (data.diagnostics.issues || []).length === 0))) process.exit(1);"

if command -v pm2 >/dev/null 2>&1 && { [ "$REQUIRE_PM2" = "1" ] || [ -n "$EXPECT_PM2_CWD" ]; }; then
  PM2_JSON="$(pm2 jlist)"
  node -e '
    const list = JSON.parse(process.argv[1]);
    const names = ["unicorn-backend", "unicorn-site", "autoscaler"];
    const apps = list.filter((p) => names.includes(p.name));
    const byName = new Map();
    for (const app of apps) {
      if (!byName.has(app.name)) byName.set(app.name, []);
      byName.get(app.name).push(app);
    }
    const failures = [];
    for (const name of names) {
      const group = byName.get(name) || [];
      if (!group.length) failures.push(`${name}:missing`);
      if (name !== "unicorn-site" && group.length !== 1) failures.push(`${name}:expected_one_got_${group.length}`);
      for (const app of group) {
        if (app.pm2_env.status !== "online") failures.push(`${name}:status_${app.pm2_env.status}`);
      }
    }
    const siteCount = (byName.get("unicorn-site") || []).length;
    if (siteCount < 1 || siteCount > 8) failures.push(`unicorn-site:unexpected_count_${siteCount}`);
    if (failures.length) {
      console.error(failures.join("\n"));
      process.exit(1);
    }
  ' "$PM2_JSON"
  echo "✅ pm2 process topology"

  if [ -n "$EXPECT_PM2_CWD" ]; then
    node -e '
      const fs = require("fs");
      const list = JSON.parse(process.argv[1]);
      const expected = fs.realpathSync(process.argv[2]);
      const apps = list.filter((p) => ["unicorn-backend", "unicorn-site", "autoscaler"].includes(p.name));
      const bad = apps.filter((p) => {
        let cwd = p.pm2_env.pm_cwd;
        try { cwd = fs.realpathSync(cwd); } catch (_) {}
        return cwd !== expected;
      });
      if (bad.length) {
        console.error(JSON.stringify(bad.map((p) => ({ name: p.name, cwd: p.pm2_env.pm_cwd, expected })), null, 2));
        process.exit(1);
      }
    ' "$PM2_JSON" "$EXPECT_PM2_CWD"
    echo "✅ pm2 cwd canonical"
  fi
elif [ "$REQUIRE_PM2" = "1" ] || [ -n "$EXPECT_PM2_CWD" ]; then
  echo "❌ pm2 required but not available" >&2
  exit 1
fi

if [ "$SKIP_PUBLIC" != "1" ]; then
  STATUS="$(curl -fsSI --max-time 15 "$PUBLIC_URL/" | awk 'NR==1{print $2}')"
  case "$STATUS" in
    200|301|302|308) echo "✅ public homepage status $STATUS" ;;
    *) echo "❌ public homepage bad status $STATUS" >&2; exit 1 ;;
  esac
  assert_node_json "public QIS intact" "$PUBLIC_URL/api/quantum-integrity/status" \
    "if (!(data.active === true && data.integrity === 'intact' && (!data.diagnostics || (data.diagnostics.issues || []).length === 0))) process.exit(1);"
fi

printf '{"ok":true,"baseUrl":"%s","publicUrl":"%s","timestamp":"%s"}\n' "$BASE_URL" "$PUBLIC_URL" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
