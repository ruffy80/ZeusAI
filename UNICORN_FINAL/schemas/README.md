# Unicorn JSON Schemas (50Y Standard)

This directory holds **public payload contracts** for ZeusAI / Unicorn.

- Format: JSON Schema **Draft 2020-12** (IETF / OpenAPI-compatible).
- Each schema declares an `x-schema-version` (semver) so consumers can
  negotiate compatibility decades into the future.
- Schemas describe **shapes that the live API guarantees**. The repository
  policy is **strictly additive**: existing fields are never removed or
  renamed. New optional fields may appear at any time.

Programmatic access is provided via:

```
GET /api/v50/schemas         # list
GET /api/v50/schemas/:id     # fetch one (Content-Type: application/schema+json)
```

All responses served by the 50Y dispatcher carry an `X-Schema-Version`
header naming the bundle hash, so any drift is detectable.

### Why this exists for 50 years

JSON Schema is an IETF-tracked standard, deliberately versioned and
compatible with the OpenAPI / AsyncAPI ecosystems. Tying every public
endpoint to a schema document means a client written in 2026 can still
parse and validate responses in 2076 without having to read the source
code of any specific server implementation.
