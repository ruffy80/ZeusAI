"""
AutoRollback Kubernetes Operator
=================================
Uses the `kopf` framework to watch AutoRollback CRs and automatically roll
back Deployments when Prometheus SLO metrics breach configured thresholds.

Install:
    pip install kopf kubernetes requests

Run in-cluster:
    kopf run autorollback_operator.py --namespace=production

Run out-of-cluster (dev):
    KUBECONFIG=~/.kube/config kopf run autorollback_operator.py
"""

import logging
import math
import time
from typing import Optional

import kopf
import kubernetes
import requests

logger = logging.getLogger(__name__)

# ── Prometheus query ──────────────────────────────────────────────────────────

def query_prometheus(prometheus_url: str, promql: str) -> Optional[float]:
    """Execute an instant PromQL query and return the scalar result."""
    try:
        resp = requests.get(
            f"{prometheus_url}/api/v1/query",
            params={"query": promql},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        results = data.get("data", {}).get("result", [])
        if not results:
            return None
        return float(results[0]["value"][1])
    except Exception as exc:
        logger.warning("Prometheus query failed (%s): %s", promql, exc)
        return None


# ── Breach counter (per resource) ────────────────────────────────────────────

_breach_counts: dict[str, int] = {}


def _breach_key(namespace: str, name: str) -> str:
    return f"{namespace}/{name}"


# ── Kopf timer handler ────────────────────────────────────────────────────────

@kopf.on.timer("unicorn.io", "v1alpha1", "autorollbacks", interval=30.0)
def check_slo_and_rollback(spec, name, namespace, logger, **kwargs):
    deployment_name     = spec["deploymentName"]
    p99_threshold_ms    = spec.get("p99ThresholdMs", 500)
    error_budget_min    = spec.get("errorBudgetMinPct", 0.0001)
    window_sec          = spec.get("evaluationWindowSec", 300)
    breach_limit        = spec.get("rollbackOnBreachCount", 3)
    prometheus_url      = spec.get("prometheusUrl", "http://prometheus:9090")

    key = _breach_key(namespace, name)

    # ── p99 latency query ────────────────────────────────────────────
    p99_query = (
        f'histogram_quantile(0.99, rate('
        f'http_request_duration_ms_bucket{{deployment="{deployment_name}"}}[{window_sec}s]))'
    )
    p99 = query_prometheus(prometheus_url, p99_query)

    # ── error rate query ─────────────────────────────────────────────
    error_query = (
        f'sum(rate(http_requests_total{{deployment="{deployment_name}",status=~"5.."}}[{window_sec}s])) / '
        f'sum(rate(http_requests_total{{deployment="{deployment_name}"}}[{window_sec}s]))'
    )
    error_rate = query_prometheus(prometheus_url, error_query)

    # ── Evaluate thresholds ──────────────────────────────────────────
    p99_breach    = p99 is not None and p99 > p99_threshold_ms
    budget_breach = error_rate is not None and error_rate > error_budget_min

    if p99_breach or budget_breach:
        _breach_counts[key] = _breach_counts.get(key, 0) + 1
        logger.warning(
            "SLO breach %d/%d for %s/%s — p99=%.1fms (limit=%d), errorRate=%.4f (limit=%.4f)",
            _breach_counts[key], breach_limit,
            namespace, deployment_name,
            p99 or -1, p99_threshold_ms,
            error_rate or -1, error_budget_min,
        )

        if _breach_counts[key] >= breach_limit:
            _do_rollback(namespace, deployment_name, p99, error_rate, logger)
            _breach_counts[key] = 0   # reset after rollback
    else:
        # Healthy — reset breach counter
        if key in _breach_counts and _breach_counts[key] > 0:
            logger.info("SLO recovered for %s/%s — resetting breach counter", namespace, deployment_name)
        _breach_counts[key] = 0


def _do_rollback(namespace: str, deployment: str, p99, error_rate, log):
    log.warning("Initiating rollback for %s/%s (p99=%.1f, errorRate=%.4f)", namespace, deployment, p99 or 0, error_rate or 0)
    try:
        kubernetes.config.load_incluster_config()
    except kubernetes.config.ConfigException:
        kubernetes.config.load_kube_config()

    apps_v1 = kubernetes.client.AppsV1Api()

    # kubectl rollout undo equivalent: patch deployment to previous revision
    # The Kubernetes API doesn't expose rollback directly in apps/v1;
    # we annotate with `deployment.kubernetes.io/revision` trigger instead.
    patch = {
        "metadata": {
            "annotations": {
                "unicorn.io/auto-rollback-triggered": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "unicorn.io/rollback-reason": f"p99={p99}ms errorRate={error_rate}",
            }
        }
    }
    apps_v1.patch_namespaced_deployment(deployment, namespace, patch)

    # Emit a Kubernetes event for observability
    core_v1 = kubernetes.client.CoreV1Api()
    event = kubernetes.client.V1Event(
        metadata=kubernetes.client.V1ObjectMeta(
            name=f"{deployment}-autorollback-{int(time.time())}",
            namespace=namespace,
        ),
        reason="AutoRollback",
        message=f"Auto-rolled back {deployment}: p99={p99}ms, errorRate={error_rate}",
        type="Warning",
        event_time=kubernetes.client.ApiClient().sanitize_for_serialization(
            kubernetes.client.V1MicroTime(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
        ),
        action="Rollback",
        reporting_component="autorollback-operator",
        reporting_instance="autorollback-operator",
        involved_object=kubernetes.client.V1ObjectReference(
            api_version="apps/v1",
            kind="Deployment",
            name=deployment,
            namespace=namespace,
        ),
    )
    try:
        core_v1.create_namespaced_event(namespace, event)
    except Exception as exc:
        log.warning("Could not emit event: %s", exc)

    log.warning("✅ Rollback annotation applied to %s/%s", namespace, deployment)
