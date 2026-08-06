# Security Report

Generated: 2026-08-06T19:42:31.727Z

## Findings
- Rate-limiting and auth middleware detected in backend routes: yes
- Webhook signature handlers detected: yes
- Potential eval/new Function usage files: 2
- Potential sync/blocking IO files: 195

## Potential risks
- Possible weak webhook compare files: 0
- Possible eval/new Function files: 2
  - backend/modules/deepseek-governor.js
  - backend/modules/self-evolving-engine.js

## Mandatory hardening checklist
- Enforce auth middleware on all webhook management endpoints
- Keep signature checks timing-safe and timestamp-bounded
- Keep admin APIs behind admin token + rate limits
- Keep CSP / Trusted Types contract enabled in site renderer