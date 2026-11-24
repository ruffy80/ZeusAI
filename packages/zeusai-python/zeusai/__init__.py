"""Official zero-dependency Python SDK for ZeusAI Unicorn (https://zeusai.pro)."""

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional


class ZeusAI:
    def __init__(
        self,
        base_url: str = "https://zeusai.pro",
        api_key: Optional[str] = None,
        ref: Optional[str] = None,
        timeout: int = 20,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.ref = ref
        self.timeout = timeout

    def _request(self, path: str, method: str = "GET", body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        headers = {"Accept": "application/json", "User-Agent": "zeusai-python/1.0.0"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(self.base_url + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return {"status": resp.status, "ok": True, "data": json.loads(resp.read().decode("utf-8"))}
        except urllib.error.HTTPError as err:
            raw = err.read().decode("utf-8", "replace")
            try:
                parsed = json.loads(raw)
            except Exception:
                parsed = {"raw": raw}
            return {
                "status": err.code,
                "ok": False,
                "payment_required": err.headers.get("X-Payment-Required"),
                "data": parsed,
            }

    def audit_website(self, url: str) -> Dict[str, Any]:
        return self._request("/api/magnet/instant-audit-teaser", "POST", {"url": url})["data"]

    def find_solution(self, persona: Optional[str] = None, industry: Optional[str] = None, goal: Optional[str] = None) -> Dict[str, Any]:
        payload: Dict[str, Any] = {}
        if persona:
            payload["persona"] = persona
        if industry:
            payload["industry"] = industry
        if goal:
            payload["goal"] = goal
        if self.ref:
            payload["ref"] = self.ref
        return self._request("/api/arre/recommend", "POST", payload)["data"]

    def negotiate_deal(self, service_ids: list, budget_usd: Optional[float] = None, rail: str = "btc") -> Dict[str, Any]:
        payload: Dict[str, Any] = {"serviceIds": service_ids, "rail": rail}
        if budget_usd is not None:
            payload["budgetUsd"] = budget_usd
        if self.ref:
            payload["referralCode"] = self.ref
        return self._request("/api/smce/negotiate", "POST", payload)["data"]

    def create_checkout(self, service_id: str, bundle_ids: Optional[list] = None, rail: str = "btc") -> Dict[str, Any]:
        payload: Dict[str, Any] = {"serviceId": service_id, "rail": rail}
        if bundle_ids:
            payload["bundleIds"] = bundle_ids
        if self.ref:
            payload["ref"] = self.ref
        return self._request("/api/smce/checkout", "POST", payload)["data"]

    def execute_paid_service(self, service_id: str, order_id: Optional[str] = None, access_token: Optional[str] = None, inputs: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"serviceId": service_id}
        if order_id:
            payload["orderId"] = order_id
        if access_token:
            payload["accessToken"] = access_token
        if inputs:
            payload["inputs"] = inputs
        return self._request("/api/x402/execute", "POST", payload)

    def enroll_affiliate(self, partner_id: str, channel: str = "python_sdk") -> Dict[str, Any]:
        return self._request("/api/arre/affiliate/enroll", "POST", {"agentOrPartnerId": partner_id, "channel": channel})["data"]

    def mcp_call(self, tool_name: str, arguments: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return self._request(
            "/api/mcp",
            "POST",
            {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": tool_name, "arguments": arguments or {}}},
        )["data"]


__all__ = ["ZeusAI"]
