# UnifyOS Production-Readiness Risk Register

| ID | Risk | Impact | Mitigation | Residual status |
|---|---|---|---|---|
| R1 | Payment success or webhook replay grants duplicate or incorrect entitlements | Critical | Persist provider event identity before processing; use unique constraints, state transitions, and server-side verification | Open until integration tests pass |
| R2 | Admin privilege escalation through frontend fields or stale sessions | Critical | Enforce roles and MFA server-side; deny by default; audit every privileged mutation | Open until authorization tests pass |
| R3 | Paystack API or webhook behavior differs by event type or region | High | Isolate adapter; consult official docs; classify unknown events safely; add fixture/contract tests | Open |
| R4 | Historical financial facts are mutated during corrections | Critical | Append-only payment/refund/credit/event records; compensating entries and immutable internal IDs | Open until schema constraints pass |
| R5 | Secrets leak into client bundles, logs, source control, or API responses | Critical | Server-only environment access, redaction, payload allowlists, secret scanning, no raw provider payloads in responses | Open until audit passes |
| R6 | Billing changes break existing free-tier workflow behavior | High | Preserve current user plan behavior; add server-side entitlement checks behind explicit billing state; regression tests | Open |
| R7 | Migration locks or partially applies in production | High | Forward-compatible migration, preflight checks, transactional DDL where supported, rollback notes, staging rehearsal | Open |
| R8 | UI reports payment or entitlement success before provider confirmation | High | Explicit pending/verified/failed states; server response is source of truth | Open |
| R9 | Render free-tier deployment cannot execute pre-deploy migrations or worker services | High | Keep migrations explicit and documented; add separate worker deployment guidance; do not claim async readiness without a worker | Open |
| R10 | Personal and tenant billing boundaries are ambiguous in the current schema | High | Start with user-scoped billing ownership and document tenant migration boundary; do not infer tenant identity from email | Open |
