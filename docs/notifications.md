# Order lifecycle events and admin order alerts

Order placement, payment outcomes, and admin status changes record typed events in PostgreSQL in the same transaction as the corresponding business change. The event keys are unique, and duplicate inserts are ignored. A `NEW_ORDER` event is written with the order transaction and powers the ADMIN in-site order alert feed. The admin feed has an admin-wide read state: when an administrator reads an alert, it is read for all administrators.

The alert feed returns only the 25 newest `NEW_ORDER` events from the last 90 days. Older events remain available as internal order-event history and are not deleted by notification retention. An alert links to its existing admin order detail page; deleting an event never deletes an order. Stored payloads contain order number, total in paisa, and currency. Customer display name and order total are read from the linked order when the ADMIN feed is rendered; email, phone, and delivery addresses are not included in the alert payload or response.

Order events are not sent through external providers. No SMS, order email delivery, worker, or external notification provider is configured. Customer account/order pages remain the customer-facing source for order updates.
