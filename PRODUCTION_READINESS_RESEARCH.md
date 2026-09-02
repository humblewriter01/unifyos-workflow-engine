# Production-readiness research notes

## Paystack

Paystack requires transaction initialization from the server using the secret key. The server must return only the checkout authorization data needed by the client. Payment value must not be granted from a browser redirect alone; the transaction status and amount must be verified server-side. Paystack webhook requests carry an `x-paystack-signature` HMAC-SHA512 signature over the raw request body. Webhooks should be acknowledged quickly, persisted idempotently, and processed asynchronously. Supported lifecycle events include successful charges, invoice/payment failures, subscription creation/disable/non-renewal, refund states, disputes, and unknown future events. Refunds are asynchronous and must not be marked processed merely because the API accepted the request.

Sources: https://paystack.com/docs/payments/accept-payments/; https://paystack.com/docs/payments/webhooks/; https://paystack.com/docs/payments/refunds/

## Security baseline

OWASP ASVS is used as the security verification baseline. The implementation will specifically cover server-side authorization, secret handling, webhook authenticity and replay resistance, input validation, sanitized errors, auditability, and secure session/privileged-operation controls.

Source: https://owasp.org/www-project-application-security-verification-standard/
