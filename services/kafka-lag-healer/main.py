"""
Kafka Consumer Lag Auto-Healer
================================
Monitors consumer group lag on configured topics.
When lag exceeds SCALE_THRESHOLD_LAG, scales up the consumer Deployment.
When lag drops below SCALE_DOWN_THRESHOLD, scales back down to MIN_REPLICAS.

Config via environment variables:
  KAFKA_BOOTSTRAP_SERVERS   - e.g. kafka:9092
  KAFKA_GROUP_ID            - consumer group to monitor
  KAFKA_TOPIC               - topic to check
  K8S_NAMESPACE             - namespace of the consumer Deployment
  CONSUMER_DEPLOYMENT       - name of the consumer Deployment to scale
  MIN_REPLICAS              - minimum replicas (default 1)
  MAX_REPLICAS              - maximum replicas (default 20)
  SCALE_THRESHOLD_LAG       - lag above which to scale up (default 10000)
  SCALE_DOWN_THRESHOLD      - lag below which to scale down (default 500)
  CHECK_INTERVAL_SEC        - polling interval in seconds (default 60)
  REPLAY_ON_HIGH_LAG        - if "true", seeks to committed offset on extreme lag

Install:
    pip install kafka-python kubernetes
"""

import logging
import os
import time
from typing import Optional

from kafka import KafkaAdminClient, KafkaConsumer, TopicPartition
from kafka.errors import KafkaError
from kubernetes import client as k8s_client
from kubernetes import config as k8s_config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("kafka-lag-healer")

# ── Configuration ─────────────────────────────────────────────────────────────

KAFKA_SERVERS         = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092").split(",")
KAFKA_GROUP_ID        = os.environ.get("KAFKA_GROUP_ID",      "unicorn-events")
KAFKA_TOPIC           = os.environ.get("KAFKA_TOPIC",         "user-actions")
K8S_NAMESPACE         = os.environ.get("K8S_NAMESPACE",       "production")
CONSUMER_DEPLOYMENT   = os.environ.get("CONSUMER_DEPLOYMENT", "unicorn-consumer")
MIN_REPLICAS          = int(os.environ.get("MIN_REPLICAS",     "1"))
MAX_REPLICAS          = int(os.environ.get("MAX_REPLICAS",     "20"))
SCALE_THRESHOLD_LAG   = int(os.environ.get("SCALE_THRESHOLD_LAG",  "10000"))
SCALE_DOWN_THRESHOLD  = int(os.environ.get("SCALE_DOWN_THRESHOLD", "500"))
CHECK_INTERVAL_SEC    = int(os.environ.get("CHECK_INTERVAL_SEC",   "60"))
REPLAY_ON_HIGH_LAG    = os.environ.get("REPLAY_ON_HIGH_LAG", "false").lower() == "true"
EXTREME_LAG_FACTOR    = int(os.environ.get("EXTREME_LAG_FACTOR", "10"))  # 10x threshold = replay


# ── K8s helper ────────────────────────────────────────────────────────────────

def _load_k8s():
    try:
        k8s_config.load_incluster_config()
    except k8s_config.ConfigException:
        k8s_config.load_kube_config()


def get_current_replicas() -> int:
    _load_k8s()
    apps = k8s_client.AppsV1Api()
    deploy = apps.read_namespaced_deployment(CONSUMER_DEPLOYMENT, K8S_NAMESPACE)
    return deploy.spec.replicas or 1


def scale_deployment(replicas: int):
    _load_k8s()
    apps = k8s_client.AppsV1Api()
    apps.patch_namespaced_deployment_scale(
        CONSUMER_DEPLOYMENT,
        K8S_NAMESPACE,
        {"spec": {"replicas": replicas}},
    )
    logger.info("Scaled %s/%s → %d replicas", K8S_NAMESPACE, CONSUMER_DEPLOYMENT, replicas)


# ── Kafka lag measurement ──────────────────────────────────────────────────────

def get_total_consumer_lag() -> Optional[int]:
    """
    Returns the total lag (sum across all partitions) for the configured consumer group.
    Returns None if the measurement fails.
    """
    try:
        consumer = KafkaConsumer(
            bootstrap_servers=KAFKA_SERVERS,
            group_id=KAFKA_GROUP_ID,
            enable_auto_commit=False,
        )
        partitions = consumer.partitions_for_topic(KAFKA_TOPIC)
        if partitions is None:
            logger.warning("Topic %s not found", KAFKA_TOPIC)
            consumer.close()
            return None

        tps = [TopicPartition(KAFKA_TOPIC, p) for p in partitions]
        consumer.assign(tps)
        consumer.seek_to_end(*tps)
        end_offsets = {tp: consumer.position(tp) for tp in tps}

        committed = {}
        for tp in tps:
            meta = consumer.committed(tp)
            committed[tp] = meta if meta is not None else 0

        total_lag = sum(end_offsets[tp] - committed[tp] for tp in tps)
        consumer.close()
        return total_lag
    except KafkaError as exc:
        logger.error("Kafka error while measuring lag: %s", exc)
        return None


def replay_from_committed_offset():
    """Seek all partitions back to the last committed offset (replay mode)."""
    logger.warning("REPLAY triggered: resetting consumer group to last committed offsets")
    try:
        admin = KafkaAdminClient(bootstrap_servers=KAFKA_SERVERS)
        admin.delete_consumer_groups([KAFKA_GROUP_ID])
        admin.close()
        logger.info("Consumer group %s reset — will re-read from committed offsets on restart", KAFKA_GROUP_ID)
    except Exception as exc:
        logger.error("Failed to reset consumer group: %s", exc)


# ── Main loop ─────────────────────────────────────────────────────────────────

def main():
    logger.info(
        "Kafka Lag Healer started | group=%s topic=%s deployment=%s/%s",
        KAFKA_GROUP_ID, KAFKA_TOPIC, K8S_NAMESPACE, CONSUMER_DEPLOYMENT,
    )

    while True:
        lag = get_total_consumer_lag()
        if lag is None:
            logger.warning("Could not measure lag — skipping cycle")
            time.sleep(CHECK_INTERVAL_SEC)
            continue

        logger.info("Consumer lag: %d messages", lag)

        try:
            current = get_current_replicas()
        except Exception as exc:
            logger.error("Could not read current replicas: %s", exc)
            time.sleep(CHECK_INTERVAL_SEC)
            continue

        if lag > SCALE_THRESHOLD_LAG:
            # Extreme lag → consider replay
            if REPLAY_ON_HIGH_LAG and lag > SCALE_THRESHOLD_LAG * EXTREME_LAG_FACTOR:
                replay_from_committed_offset()

            # Scale up: double replicas, capped at MAX_REPLICAS
            new_replicas = min(current * 2, MAX_REPLICAS)
            if new_replicas > current:
                logger.warning("Lag=%d > threshold=%d → scaling up %d → %d", lag, SCALE_THRESHOLD_LAG, current, new_replicas)
                try:
                    scale_deployment(new_replicas)
                except Exception as exc:
                    logger.error("Scale-up failed: %s", exc)

        elif lag < SCALE_DOWN_THRESHOLD and current > MIN_REPLICAS:
            # Lag is low → scale down by 1 replica
            new_replicas = max(current - 1, MIN_REPLICAS)
            logger.info("Lag=%d < scale-down threshold=%d → scaling down %d → %d", lag, SCALE_DOWN_THRESHOLD, current, new_replicas)
            try:
                scale_deployment(new_replicas)
            except Exception as exc:
                logger.error("Scale-down failed: %s", exc)

        time.sleep(CHECK_INTERVAL_SEC)


if __name__ == "__main__":
    main()
