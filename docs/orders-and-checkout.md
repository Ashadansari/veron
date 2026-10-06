# Orders, checkout, and cancellation

The customer checkout is protected by the current server session. The browser submits only a saved address ID and payment method; unknown fields such as price, subtotal, shipping amount, total, and payment status are rejected. The order service loads the user's database cart, current active products and variants, current sale prices, inventory, shipping rule, and store currency again when the request is submitted.

## Order transaction

The service locks the cart row, validates every cart line and saved address ownership, and recalculates amounts using integer paisa. It inserts an order with a customer-friendly unique `NFS-…` number, a copy of the delivery address, line-item snapshots, a COD payment record, and the initial status event. Each stock decrement is an atomic conditional update that checks available stock (`onHand - reserved`). Any failure rolls back the entire transaction, including earlier stock changes, order/payment records, and cart deletion. The cart is cleared only at the end of a successful transaction.

COD checkout records `paymentMethod=COD` and `paymentStatus=UNPAID` on the order and payment record. Online payment is intentionally unavailable until a provider is configured. `src/lib/commerce/payment-provider.ts` defines a server-only provider interface for creating a payment and verifying provider-signed webhook results; there is no client callback that can mark an order paid.

## Ownership and order operations

Customer order list, order detail, success, and cancellation queries are scoped by the authenticated customer ID in PostgreSQL queries. The admin order list is limited to recent orders and supports order/customer/phone search plus order and payment status filters. Admin status changes validate the existing PostgreSQL enum and transition map in a transaction with the order row locked. Customers cannot update status or payment fields.

Customers may cancel only their own `PLACED` and `UNPAID` order. Admins may cancel an order before shipment. Cancellation locks the order, restores the ordered quantities to inventory in the same transaction, records a status event, and cannot run twice. Completed, shipped, returned, and otherwise ineligible orders are not cancelled by the customer workflow. If a paid order is cancelled by an admin, its payment remains `PAID`; the event says that a refund follow-up is required. No refund is processed by this phase.

## Data model

Phase 6 reuses the existing `orders`, `order_items`, `payment_records`, `order_status_events`, `carts`, `cart_items`, `addresses`, `inventory`, `shipping_rules`, and `store_settings` tables. No schema migration was needed. Line items and delivery details are historical snapshots, so later catalog/address edits do not rewrite existing orders.
