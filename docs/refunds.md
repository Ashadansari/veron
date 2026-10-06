# Refund controls and manual workflow

## Current product behavior

The application does not call a provider refund API and does not record a confirmed external refund. Cancelling a paid order intentionally leaves payment status `PAID` and adds a refund-follow-up note. Until a reviewed refund-recording feature exists, the restricted business refund ledger is the source of truth for refund completion; the app's payment status alone is not refund accounting. Never change payment status to `REFUNDED` based on an order cancellation, browser return, customer report, or refund request.

## Manual workflow

1. An authorized operator opens the order and verifies that it is actually captured/paid, the provider and transaction reference match the merchant portal, the order is eligible, and the requested NPR amount and reason are correct. COD collections are reconciled separately; do not issue a provider refund for uncollected COD.
2. Stop fulfillment using the allowed order-state transition. Order cancellation and stock restoration are one transactional action. A locked order transition can cancel/restore stock only once; do not manually edit stock as part of refund processing.
3. A second authorized operator independently reviews the order, provider transaction reference, amount, currency (NPR), customer destination, and reason before any provider-portal submission. The refund workflow must never call order cancellation or inventory restoration a second time.
4. Submit the refund once through the provider's approved merchant portal. Record it as pending in the restricted business ledger, including an internal case ID, order number, provider, payment transaction reference, requested amount, submitter, reviewer, and timestamp. Do not record it as completed yet.
5. Wait for explicit provider confirmation and verify the provider refund reference, confirmed amount, currency, and timestamp in the merchant portal/settlement record. Record that confirmation and reconcile it to the bank/accounting ledger. If status is ambiguous, hold the case and contact the provider; do not retry blindly.
6. Close the ledger case only after confirmation and reconciliation. Keep the original order, payment attempt, status history, stock movement, review, and provider references under the approved retention controls. Do not delete or overwrite business records.

Provider refund APIs are not implemented. If one is added later, use an idempotency key unique to the payment/refund request, a transactional refund record with a unique provider refund reference, server-side ADMIN authorization, a state machine such as `REQUESTED → SUBMITTED → CONFIRMED` or `FAILED`, and reconciliation of provider status before marking `REFUNDED`. Refund completion must not restore stock or alter order fulfillment; those transitions remain separate and repeat-safe. Require audit history and tests for duplicate callbacks, retry behavior, partial/full amounts, and concurrent operators before enabling it.
