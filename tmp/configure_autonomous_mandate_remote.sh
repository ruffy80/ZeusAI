#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
from pathlib import Path
import json, time, secrets

root = Path('/var/www/unicorn/UNICORN_FINAL/data')
roadmap_path = root / 'roadmap.json'
queue_path = root / 'deepseek-commands.jsonl'

roadmap = {}
if roadmap_path.exists():
    try:
        roadmap = json.loads(roadmap_path.read_text(encoding='utf-8'))
    except Exception:
        roadmap = {}

roadmap['vision'] = 'Autonomous Unicorn Global SaaS — resilient, conversion-optimized, and compounding revenue engine.'
roadmap['missionForDeepSeek'] = (
    'Operate 24/7 as Growth + Reliability engineer. Always protect uptime first, then improve revenue. '
    'Cycle strictly: diagnose -> implement -> validate -> finalize. Never leave objectives unfinished.'
)
roadmap['currentPhase'] = 'autonomous-execution'
roadmap['northStarMetric'] = 'daily_net_revenue_usd'
roadmap['northStarTargets'] = {
    'daily_net_revenue_usd': 100000,
    'checkout_conversion_rate': 0.04,
    'availability_slo': 0.999,
}

now = int(time.time())
iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

def objective(id_, title, priority, metricEndpoint, metricKey, target, comparison='gte', innovation=False):
    return {
        'id': id_,
        'title': title,
        'status': 'pending',
        'priority': priority,
        'innovation': innovation,
        'metricEndpoint': metricEndpoint,
        'metricKey': metricKey,
        'target': target,
        'comparison': comparison,
        'createdAt': iso,
    }

roadmap['objectives'] = [
    objective('REL-001', 'Keep live uptime at or above SLO with zero critical regressions', 1, '/health', 'ok', True, 'eq', False),
    objective('CRO-001', 'Increase service-to-checkout conversion through UX and copy improvements', 2, '/api/analytics/funnel', 'checkout_start', 1, 'gte', False),
    objective('CRO-002', 'Increase paid conversion from checkout flow', 3, '/api/analytics/funnel', 'checkout_paid', 1, 'gte', False),
    objective('PRC-001', 'Stabilize dynamic pricing and raise revenue/session without harming conversion', 4, '/api/pricing/all', 'ok', True, 'eq', False),
    objective('SEO-001', 'Expand high-intent landing pages and internal linking toward checkout', 5, '/services', 'status', 200, 'eq', True),
    objective('OPS-001', 'Continuously run validation: tests + smoke before finalizing changes', 6, '/health', 'ok', True, 'eq', False),
]

roadmap_path.write_text(json.dumps(roadmap, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

cmd = {
    'id': f'cmd_{now}_{secrets.token_hex(4)}',
    'ts': iso,
    'priority': 1,
    'instruction': (
        'Execute autonomous roadmap with strict safety: uptime first, then CRO and pricing, then SEO innovation. '
        'For each objective do diagnose->implement->validate->roadmap_update(done/blocked). '
        'Avoid repetitive no-op cycles. Favor small, testable, production-safe increments.'
    ),
    'source': 'owner-mandate',
}
queue_path.parent.mkdir(parents=True, exist_ok=True)
with queue_path.open('a', encoding='utf-8') as f:
    f.write(json.dumps(cmd, ensure_ascii=False) + '\n')

print('roadmap_updated', roadmap_path)
print('queue_appended', queue_path)
print('objectives', len(roadmap['objectives']))
print('command_id', cmd['id'])
PY

systemctl restart deepseek-loop
sleep 4
systemctl is-active deepseek-loop

echo "last_actions:"
tail -n 80 /var/www/unicorn/UNICORN_FINAL/data/logs/deepseek-loop.log | egrep -i "recommendation_received|governor_execution_result|roadmap_update|code_proposal|run_test|prices_sync|checkout_fix" | tail -n 20 || true
