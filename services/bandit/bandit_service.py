"""
Thompson Sampling Contextual Bandit Service
============================================
Assigns traffic to the best-performing variants to maximise revenue per user.

Context features: user_segment, hour_of_day, device_type
Arms: active variants registered by the Profit Control Loop
Reward: profit attribution signal from ProfitAttributionService

REST API (run with: uvicorn bandit_service:app --port 8001):
  POST /select          → pick the best arm for a context
  POST /update          → update arm posterior with observed reward
  GET  /weights         → current traffic allocation weights (for Istio)
  GET  /status          → arm summaries
  POST /register        → register a new arm (variant)
  DELETE /arms/{arm_id} → remove an arm

Install:
    pip install fastapi uvicorn numpy
"""

import math
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Unicorn Bandit Service", version="1.0.0")


# ── Data models ───────────────────────────────────────────────────────────────

@dataclass
class BanditArm:
    variant_id: str
    domain: str = "unknown"
    alpha: float = 1.0   # Beta distribution: successes + 1
    beta:  float = 1.0   # Beta distribution: failures  + 1
    total_profit: float = 0.0
    total_reward: float = 0.0
    pulls: int = 0
    registered_at: float = field(default_factory=time.time)

    @property
    def mean(self) -> float:
        return self.alpha / (self.alpha + self.beta)

    def sample(self) -> float:
        return float(np.random.beta(self.alpha, self.beta))


class SelectRequest(BaseModel):
    context: Dict = {}
    exclude: List[str] = []


class SelectResponse(BaseModel):
    selected_arm: str
    confidence: float
    context: Dict


class UpdateRequest(BaseModel):
    variant_id: str
    profit: float
    baseline_profit: float
    context: Dict = {}


class RegisterRequest(BaseModel):
    variant_id: str
    domain: str = "unknown"


class WeightsResponse(BaseModel):
    weights: Dict[str, float]
    total_arms: int
    timestamp: str


# ── Bandit state ──────────────────────────────────────────────────────────────

arms: Dict[str, BanditArm] = {
    "control": BanditArm(variant_id="control", domain="control"),
}
pull_history: List[dict] = []
MAX_HISTORY = 5000


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/register")
def register_arm(req: RegisterRequest):
    if req.variant_id not in arms:
        arms[req.variant_id] = BanditArm(variant_id=req.variant_id, domain=req.domain)
    return {"registered": req.variant_id, "total_arms": len(arms)}


@app.delete("/arms/{arm_id}")
def remove_arm(arm_id: str):
    if arm_id == "control":
        raise HTTPException(status_code=400, detail="Cannot remove control arm")
    if arm_id not in arms:
        raise HTTPException(status_code=404, detail="Arm not found")
    del arms[arm_id]
    return {"removed": arm_id, "total_arms": len(arms)}


@app.post("/select", response_model=SelectResponse)
def select_arm(req: SelectRequest):
    """Thompson Sampling: sample from each arm's Beta distribution, pick the highest."""
    eligible = {vid: arm for vid, arm in arms.items() if vid not in req.exclude}
    if not eligible:
        eligible = arms  # fallback: all arms

    # Context-aware weighting (simple: adjust alpha by time-of-day multiplier)
    hour = req.context.get("hour_of_day", time.gmtime().tm_hour)
    peak_multiplier = 1.2 if 9 <= hour <= 21 else 0.9  # higher confidence during peak hours

    samples = {}
    for vid, arm in eligible.items():
        adjusted_alpha = arm.alpha * (peak_multiplier if arm.domain == "PRICING_STRATEGY" else 1.0)
        samples[vid] = float(np.random.beta(max(adjusted_alpha, 0.01), max(arm.beta, 0.01)))

    best = max(samples, key=samples.get)
    confidence = samples[best] / (sum(samples.values()) or 1)

    pull_history.append({
        "ts": time.time(), "selected": best, "samples": samples, "context": req.context,
    })
    if len(pull_history) > MAX_HISTORY:
        pull_history.pop(0)

    return SelectResponse(selected_arm=best, confidence=round(confidence, 4), context=req.context)


@app.post("/update")
def update_arm(req: UpdateRequest):
    """Update the arm posterior based on whether it beat baseline (binary reward)."""
    arm = arms.get(req.variant_id)
    if not arm:
        raise HTTPException(status_code=404, detail=f"Unknown arm: {req.variant_id}")

    arm.pulls += 1
    arm.total_profit += req.profit
    reward = req.profit - req.baseline_profit

    if reward > 0:
        arm.alpha += 1.0
        arm.total_reward += reward
    else:
        arm.beta += 1.0

    return {"variant_id": req.variant_id, "alpha": arm.alpha, "beta": arm.beta, "mean": arm.mean}


@app.get("/weights", response_model=WeightsResponse)
def get_weights():
    """
    Return softmax-normalised weights from each arm's Beta mean.
    These weights can be patched directly into the Istio VirtualService.
    """
    means = {vid: arm.mean for vid, arm in arms.items()}
    total = sum(means.values()) or 1.0
    weights = {vid: round(v / total, 4) for vid, v in means.items()}
    return WeightsResponse(
        weights=weights,
        total_arms=len(arms),
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )


@app.get("/status")
def get_status():
    return {
        "arms": [
            {
                "variant_id": arm.variant_id,
                "domain":     arm.domain,
                "alpha":      round(arm.alpha, 4),
                "beta":       round(arm.beta, 4),
                "mean":       round(arm.mean, 4),
                "pulls":      arm.pulls,
                "total_profit": round(arm.total_profit, 4),
            }
            for arm in arms.values()
        ],
        "total_pulls": sum(a.pulls for a in arms.values()),
        "history_count": len(pull_history),
    }


@app.get("/health")
def health():
    return {"ok": True, "arms": len(arms)}
