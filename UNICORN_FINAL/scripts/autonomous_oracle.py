#!/usr/bin/env python3
# =====================================================================
# OWNERSHIP: Vladoi Ionut  <vladoi_ionut@yahoo.com>
# BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
# =====================================================================
# ZEUS BRAINSTEM — Autonomous Oracle (right hemisphere / survival reflexes)
#
# EN: This is the root-level reflex layer of the ZeusAI bicameral mind.
#     Unlike the governor-sandboxed cortex (deepseek-unified.js), the
#     brainstem CAN heal the operating system: restart dead PM2 apps and
#     systemd units, reap zombie/orphan processes, and free disk pressure.
#     Every cycle it:
#       1. Collects deterministic VITALS from local endpoints (no LLM).
#       2. Runs DETERMINISTIC reflexes (self-heal) — never depends on DeepSeek.
#       3. Optionally asks DeepSeek for ONE extra one-line safe command,
#          which is parsed (markdown stripped) and whitelisted before exec.
#       4. Writes the shared CONSCIOUSNESS file (corpus callosum) so the
#          cortex can read the body's real state and coordinate.
#
# RO: Acesta este trunchiul cerebral — stratul de reflexe la nivel root al
#     minții bicamerale ZeusAI. Spre deosebire de cortexul izolat de
#     guvernor (deepseek-unified.js), trunchiul POATE vindeca sistemul de
#     operare: repornește aplicații PM2/systemd moarte, curăță procese
#     orfane și eliberează presiunea de pe disc. Nu depinde NICIODATĂ de
#     DeepSeek pentru reflexele vitale.
#
# Safety envelope:
#   * Reflexes (self-heal) are deterministic Python — reliable even if the
#     DeepSeek API is down or returns garbage.
#   * DeepSeek output is parsed (markdown fences/bullets/comments stripped)
#     and every command is matched against a strict ALLOW prefix list.
#   * Hard DENY of shell control flow, pipes, redirects, command chaining,
#     and destructive verbs. No eval. No arbitrary file writes.
#   * Each command runs with a timeout; failures are logged, never fatal.
# =====================================================================
import json
import os
import re
import subprocess
import time
from datetime import datetime, timezone

try:
    import requests  # confirmed installed on server
except Exception:  # pragma: no cover - defensive
    requests = None

# -------- Configuration / Configurație -------------------------------
WORKDIR = os.environ.get("ORACLE_WORKDIR", "/var/www/unicorn/UNICORN_FINAL")
INTERVAL = max(20, int(os.environ.get("ORACLE_INTERVAL", "60")))
LOG_PATH = os.environ.get("ORACLE_LOG_PATH", os.path.join(WORKDIR, "oracle_log.json"))
CONSCIOUSNESS_PATH = os.environ.get(
    "ZEUS_CONSCIOUSNESS_PATH", os.path.join(WORKDIR, "data", "zeus-consciousness.json")
)
HISTORY_MAX = 40
CMD_TIMEOUT = int(os.environ.get("ORACLE_CMD_TIMEOUT", "25"))

DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()
DEEPSEEK_API_URL = os.environ.get(
    "DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions"
)
DEEPSEEK_MODEL = os.environ.get("ORACLE_DEEPSEEK_MODEL", "deepseek-chat")
DEEPSEEK_ENABLED = os.environ.get("ORACLE_DEEPSEEK_ENABLED", "1") == "1"

# Admin secret lets the brainstem activate autonomy modules via the SUPPORTED
# POST /api/autonomy/activate endpoint (in-process start, stable-mode safe).
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "").strip()
ACTIVATE_COOLDOWN = int(os.environ.get("ORACLE_ACTIVATE_COOLDOWN", "1800"))  # 30 min
# Modules the activate endpoint can legitimately bring online.
ACTIVATABLE = {
    "autoInnovationLoop", "selfHealingEngine", "centralOrchestrator",
    "quantumIntegrityShield", "meshOrchestrator", "profitControlLoop",
}

# Mutable runtime state for cooldowns / one-shot reflexes.
_state = {"last_activate": 0.0}

BACKEND = "http://127.0.0.1:3000"
SITE = "http://127.0.0.1:3001"

# Critical processes the brainstem keeps alive (deterministic reflex).
PM2_CRITICAL = ["unicorn-backend", "unicorn-site"]
# The cortex hemisphere. systemd already has Restart=always on it; this is a
# cross-hemisphere watchdog so the brainstem revives the cortex if systemd
# ever gives up. (Must match the unit name written by zeus-supreme-install.sh.)
SYSTEMD_CRITICAL = ["zeus-cortex.service"]

# -------- Strict command whitelist for DeepSeek suggestions ----------
# Only single-line, side-effect-bounded commands are allowed to run.
ALLOW_PREFIXES = (
    "curl -s http://127.0.0.1:3000",
    "curl -s http://127.0.0.1:3001",
    "curl -s http://localhost:3000",
    "curl -s http://localhost:3001",
    "curl -s https://zeusai.pro",
    "pm2 describe ",
    "pm2 ls",
    "pm2 restart unicorn-backend",
    "pm2 restart unicorn-site",
    "pm2 reload unicorn-backend",
    "pm2 reload unicorn-site",
    "systemctl is-active ",
    "systemctl restart unicorn-",
    "systemctl restart deepseek-unified",
    "systemctl restart autonomous-oracle",
    "node -v",
    "npm run lint",
    "df -h",
    "free -m",
    "uptime",
    "tail -n ",
    "grep -",
    "cat /var/www/unicorn/UNICORN_FINAL/data/",
    "ls /var/www/unicorn/UNICORN_FINAL",
    "echo ",
)

# Any of these tokens anywhere in a candidate command → hard reject.
DENY_TOKENS = (
    ";", "&&", "||", "|", "`", "$(", ">", "<", "{", "}",
    " if ", " for ", " while ", "then", " fi", " do ", "done",
    "rm ", "rm -", "mv ", "dd ", "mkfs", "kill ", "pkill", "shutdown",
    "reboot", "chmod 777", "chown ", ":(){", "curl -o", "wget ",
    "scp ", "ssh ", ">>", "tee ", "eval", "exec ", "/.env", "id_rsa",
    "passwd", "useradd", "userdel", "iptables", "ufw ",
)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def run(cmd, timeout=CMD_TIMEOUT):
    """Run a shell command with a hard timeout; return (ok, output)."""
    try:
        p = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout
        )
        out = (p.stdout or "") + (("\n" + p.stderr) if p.returncode != 0 and p.stderr else "")
        return p.returncode == 0, out.strip()
    except subprocess.TimeoutExpired:
        return False, "timeout"
    except Exception as e:  # pragma: no cover
        return False, str(e)


def get_json(url, timeout=5):
    """GET a local JSON endpoint, returning a dict or {} on failure."""
    if requests is None:
        return {}
    try:
        r = requests.get(url, timeout=timeout)
        if r.status_code == 200:
            try:
                return r.json()
            except Exception:
                return {"_raw": r.text[:400]}
    except Exception:
        return {}
    return {}


def get_text(url, timeout=6):
    if requests is None:
        return ""
    try:
        r = requests.get(url, timeout=timeout)
        return r.text or ""
    except Exception:
        return ""


# -------- 1) VITALS — deterministic, no LLM --------------------------
def collect_vitals():
    v = {"ts": now_iso()}
    health = get_json(BACKEND + "/api/health")
    v["backendUp"] = bool(health.get("status") == "ok")
    v["users"] = health.get("users")
    v["uptime"] = health.get("uptime")
    v["dbConnected"] = health.get("dbConnected")

    autonomy = get_json(BACKEND + "/api/autonomy/status")
    mods = autonomy.get("modules", {}) if isinstance(autonomy, dict) else {}
    v["autonomyModules"] = {
        k: bool(val.get("active")) for k, val in mods.items() if isinstance(val, dict)
    }

    rev = get_json(BACKEND + "/api/revenue/autopilot/status")
    v["revenueAutopilot"] = bool(rev.get("enabled"))
    v["revenueRuns"] = rev.get("runs")
    v["revenueErrors"] = rev.get("errors")

    pricing = get_json(BACKEND + "/api/pricing/all")
    if isinstance(pricing, dict):
        items = pricing.get("items") or pricing.get("services") or pricing.get("data")
        v["pricingItems"] = len(items) if isinstance(items, list) else None

    # Site "Loading..." stuck detector (CSP/catalog warm-up regression guard).
    site_html = get_text("https://zeusai.pro/pricing")
    v["pricingLoadingStuck"] = len(re.findall(r"Loading\.\.\.", site_html))

    # PM2 + systemd presence.
    pm2 = {}
    for name in PM2_CRITICAL:
        ok, _ = run(f"pm2 describe {name} 2>/dev/null | grep -q online && echo up", 10)
        pm2[name] = ok
    v["pm2"] = pm2

    sysd = {}
    for unit in SYSTEMD_CRITICAL:
        ok, out = run(f"systemctl is-active {unit}", 8)
        sysd[unit] = out
    v["systemd"] = sysd

    ok, disk = run("df -h / | tail -1 | awk '{print $5}'", 8)
    v["diskUsedPct"] = disk if ok else None
    return v


# -------- 2) REFLEXES — deterministic self-healing -------------------
def reflexes(vitals):
    acted = []

    # Restart dead PM2 critical apps.
    for name, up in (vitals.get("pm2") or {}).items():
        if not up:
            ok, _ = run(f"pm2 restart {name}", 30)
            acted.append(f"reflex:pm2_restart:{name}:{'ok' if ok else 'fail'}")

    # Restart dead critical systemd units (e.g. dormant cortex).
    for unit, state in (vitals.get("systemd") or {}).items():
        if state != "active":
            ok, _ = run(f"systemctl restart {unit}", 30)
            acted.append(f"reflex:systemctl_restart:{unit}:{'ok' if ok else 'fail'}")

    # Reap phantom/orphan zeus-watchdog (unit deleted but process lingers).
    ok, out = run(
        "ps -eo pid,etimes,cmd | grep -i 'zeus-watchdog' | grep -v grep | awk '{print $1}'",
        8,
    )
    if ok and out.strip():
        for pid in out.split():
            if pid.isdigit():
                run(f"kill -TERM {pid}", 8)
                acted.append(f"reflex:reap_phantom_watchdog:{pid}")

    # Disk pressure relief: trim PM2 logs if disk > 90%.
    used = (vitals.get("diskUsedPct") or "0%").replace("%", "")
    try:
        if int(used) >= 90:
            run("pm2 flush", 20)
            acted.append("reflex:pm2_flush:disk_pressure")
    except ValueError:
        pass

    # Activate dormant autonomy modules via the SUPPORTED admin endpoint.
    # Bounded by cooldown so we never hammer the backend. This is what brings
    # centralOrchestrator + profitControlLoop (the revenue engine) online in
    # the otherwise-stable runtime, exactly as the activate endpoint intends.
    acted += activate_modules(vitals)

    return acted


def activate_modules(vitals):
    """Best-effort activation of inactive autonomy modules (cooldown-bounded)."""
    if not (ADMIN_SECRET and requests):
        return []
    mods = vitals.get("autonomyModules") or {}
    inactive = [k for k in ACTIVATABLE if mods.get(k) is False]
    if not inactive:
        return []
    if (time.time() - _state.get("last_activate", 0)) < ACTIVATE_COOLDOWN:
        return []
    _state["last_activate"] = time.time()
    try:
        r = requests.post(
            BACKEND + "/api/autonomy/activate",
            headers={"x-admin-secret": ADMIN_SECRET, "Content-Type": "application/json"},
            json={},
            timeout=15,
        )
        ok = r.status_code == 200
        activated = 0
        if ok:
            try:
                activated = r.json().get("activated", 0)
            except Exception:
                activated = 0
        return [f"reflex:activate_modules:{'ok' if ok else r.status_code}:"
                f"activated={activated}:targets={','.join(inactive)}"]
    except Exception as e:
        return [f"reflex:activate_modules:error:{str(e)[:80]}"]


# -------- 3) DeepSeek augmentation (parsed + whitelisted) ------------
def parse_commands(plan):
    """Strip markdown fences, comments, bullets, prompts; yield clean lines."""
    out = []
    for raw in (plan or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("```") or line.startswith("#"):
            continue
        # Strip leading bullet/list/prompt markers.
        line = re.sub(r"^([-*>]|\d+[.)]|\$)\s+", "", line).strip()
        # Strip inline code backticks.
        line = line.strip("`").strip()
        if not line:
            continue
        out.append(line)
    return out


def allowed(cmd):
    low = " " + cmd.lower() + " "
    for tok in DENY_TOKENS:
        if tok in low or tok in cmd:
            return False
    return any(cmd.startswith(p) for p in ALLOW_PREFIXES)


def ask_deepseek(vitals, recent_actions):
    if not (DEEPSEEK_ENABLED and DEEPSEEK_API_KEY and requests):
        return ""
    system = (
        "You are the ZeusAI brainstem operator for zeusai.pro (owner Vladoi Ionut, "
        "BTC bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e). You keep the live server "
        "healthy. Given the VITALS JSON, return AT MOST 3 single-line, read-mostly "
        "bash commands to inspect or gently heal the system. "
        "STRICT RULES: Return ONLY raw commands, one per line. NO markdown fences. "
        "NO backticks. NO comments. NO if/for/while blocks. NO pipes except none. "
        "NO redirects. NO rm/kill/mv. Prefer curl health probes, pm2 describe, "
        "systemctl is-active, df -h, tail. If everything is healthy, return: echo healthy"
    )
    user = (
        "VITALS:\n" + json.dumps(vitals, ensure_ascii=False)[:3500]
        + "\nRECENT_BRAINSTEM_ACTIONS:\n" + json.dumps(recent_actions[-6:], ensure_ascii=False)
    )
    try:
        r = requests.post(
            DEEPSEEK_API_URL,
            headers={
                "Authorization": "Bearer " + DEEPSEEK_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "model": DEEPSEEK_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.0,
                "max_tokens": 180,
            },
            timeout=40,
        )
        if r.status_code == 200:
            return r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        return ""  # DeepSeek failure is non-fatal; reflexes already ran.
    return ""


def execute_suggestions(plan):
    results = []
    cmds = parse_commands(plan)[:3]
    for cmd in cmds:
        if allowed(cmd):
            ok, out = run(cmd)
            results.append(f"{'OK' if ok else 'FAIL'} {cmd} :: {out[:280]}")
        else:
            results.append(f"BLOCKED {cmd}")
    return results


# -------- 4) CONSCIOUSNESS (corpus callosum) -------------------------
def read_consciousness():
    try:
        with open(CONSCIOUSNESS_PATH, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def write_consciousness(vitals, reflex_actions, suggestions, directive):
    prev = read_consciousness()
    doc = {
        "schema": "zeus-consciousness/1",
        "updatedAt": now_iso(),
        "owner": "Vladoi Ionut",
        "btc": "bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e",
        # Brainstem section (this process owns it).
        "brainstem": {
            "alive": True,
            "lastCycle": now_iso(),
            "vitals": vitals,
            "reflexes": reflex_actions,
            "suggestions": suggestions,
            "directiveForCortex": directive,
        },
        # Preserve whatever the cortex wrote about itself.
        "cortex": prev.get("cortex", {}),
    }
    tmp = CONSCIOUSNESS_PATH + ".tmp"
    os.makedirs(os.path.dirname(CONSCIOUSNESS_PATH), exist_ok=True)
    with open(tmp, "w") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)
    os.replace(tmp, CONSCIOUSNESS_PATH)


def derive_directive(vitals):
    """One sentence telling the cortex where to focus next.

    NOTE: OS-level and module activation are the brainstem's job (handled by
    reflexes). The directive steers the cortex toward code/innovation work it
    can actually perform through the governor allowlist.
    """
    if not vitals.get("backendUp"):
        return "Backend down — hold proposals; brainstem is restarting it."
    if vitals.get("pricingLoadingStuck", 0) > 0:
        return ("Pricing page stuck on Loading — author a code_proposal fixing "
                "the CSP/catalog warm-up regression in UNICORN_FINAL/src.")
    if vitals.get("revenueErrors"):
        return ("Revenue autopilot reporting errors — read_file the revenue "
                "module, diagnose, and propose a fix.")
    return ("All vitals green — generate an innovation code_proposal for a "
            "feature no competing SaaS has yet (AI-personalized pricing, "
            "BTC Lightning instant settlement, revenue-anomaly self-healing).")


def write_log(history):
    ok = sum(1 for h in history for r in h.get("result", []) if str(r).startswith("OK"))
    fail = sum(1 for h in history for r in h.get("result", []) if str(r).startswith("FAIL"))
    doc = {
        "updatedAt": now_iso(),
        "stats": {"cycles": len(history), "ok": ok, "fail": fail},
        "history": history[-HISTORY_MAX:],
    }
    tmp = LOG_PATH + ".tmp"
    with open(tmp, "w") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)
    os.replace(tmp, LOG_PATH)


# -------- Main loop --------------------------------------------------
def main():
    history = []
    try:
        existing = json.load(open(LOG_PATH))
        history = existing.get("history", [])[-HISTORY_MAX:]
    except Exception:
        history = []

    recent_reflexes = []
    print(f"[brainstem] online interval={INTERVAL}s deepseek={'on' if DEEPSEEK_ENABLED and DEEPSEEK_API_KEY else 'off'}", flush=True)

    while True:
        cycle = {"ts": now_iso()}
        try:
            vitals = collect_vitals()
            reflex_actions = reflexes(vitals)
            recent_reflexes = (recent_reflexes + reflex_actions)[-12:]

            plan = ask_deepseek(vitals, recent_reflexes)
            suggestions = execute_suggestions(plan)

            directive = derive_directive(vitals)
            write_consciousness(vitals, reflex_actions, suggestions, directive)

            cycle["vitals"] = vitals
            cycle["reflexes"] = reflex_actions
            cycle["result"] = suggestions
            cycle["directive"] = directive
        except Exception as e:
            cycle["error"] = str(e)

        history.append(cycle)
        history = history[-HISTORY_MAX:]
        try:
            write_log(history)
        except Exception as e:
            print(f"[brainstem] log-write-error {e}", flush=True)

        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
