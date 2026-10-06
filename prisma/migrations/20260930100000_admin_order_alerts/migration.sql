ALTER TABLE notification_events
  ADD COLUMN admin_read_at timestamptz;

ALTER TABLE notification_events
  DROP CONSTRAINT notification_events_event_type_check;

ALTER TABLE notification_events
  ADD CONSTRAINT notification_events_event_type_check CHECK (event_type IN (
    'ORDER_PLACED', 'COD_ORDER_CONFIRMATION', 'ONLINE_PAYMENT_SUCCESS',
    'PAYMENT_FAILURE', 'ORDER_STATUS_CHANGED', 'ORDER_CANCELLED', 'NEW_ORDER'
  ));

CREATE INDEX notification_events_admin_feed_idx
  ON notification_events(event_type, created_at DESC);
