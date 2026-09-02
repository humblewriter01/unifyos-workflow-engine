# UnifyOS Production-Readiness Implementation Plan

## Interpreted feature scope

The attached prompt contains many platform requirements rather than exactly two isolated features. For this implementation, the two feature areas are interpreted as **(1) a production-grade administrative and catalog console** and **(2) a production-grade Paystack billing and customer billing experience**. Existing workflow and authentication behavior will be preserved unless required for authorization, billing enforcement, or correctness.

## Delivery slices

1. Establish an explicit billing and administration domain model with versioned plans, prices, features, entitlements, subscriptions, payments, provider events, refunds, audit events, and immutable financial identifiers.
2. Add server-side authorization for administrator roles with mandatory MFA checks for privileged operations, reason/confirmation requirements, audit logging, and fail-closed behavior.
3. Add Paystack provider isolation, server-side transaction initialization and verification, webhook signature validation, replay protection, idempotent event persistence, and safe entitlement transitions.
4. Add customer billing APIs and UI for plan/usage/status visibility, checkout summaries, payment history, and cancellation semantics without exposing payment credentials.
5. Add administrator APIs and UI for plan/price/catalog lifecycle, subscription search, controlled entitlement operations, reconciliation visibility, and audited operational controls.
6. Add tests, deployment configuration, environment documentation, rollback notes, and production-readiness evidence.

## Architectural constraints

The web tier remains stateless and Prisma/PostgreSQL remains the system of record. Provider calls occur only on the server. Paystack is an adapter, not a schema-wide assumption. Billing records use integer minor units and explicit ISO currency codes. Financial records and provider events are append-only or state-transition constrained. No client redirect, frontend plan value, or untrusted identity header grants access.

## Acceptance evidence

A clean install/build must pass. Authorization tests must prove non-admin denial and MFA enforcement. Payment tests must cover initialization, verification, duplicate/out-of-order webhook handling, unknown events, failed payments, cancellation, and refund state transitions using safe fixtures. UI tests must show accurate pending/failed/success states. Database migration and rollback behavior must be documented.
