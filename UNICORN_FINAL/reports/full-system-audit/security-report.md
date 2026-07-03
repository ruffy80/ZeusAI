# Security Report

Generated: 2026-07-03T13:19:35.620Z

## Findings
- Rate-limiting and auth middleware detected in backend routes: yes
- Webhook signature handlers detected: yes
- Potential eval/new Function usage files: 2
- Potential sync/blocking IO files: 126

## Potential risks
- Possible weak webhook compare files: 1
  - backend/index.js
- Possible eval/new Function files: 2
  - backend/modules/deepseek-governor.js
  - backend/modules/self-evolving-engine.js

## Mandatory hardening checklist
- Enforce auth middleware on all webhook management endpoints
- Keep signature checks timing-safe and timestamp-bounded
- Keep admin APIs behind admin token + rate limits
- Keep CSP / Trusted Types contract enabled in site renderer