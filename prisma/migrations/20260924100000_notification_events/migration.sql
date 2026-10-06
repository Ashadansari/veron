CREATE TABLE notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  event_type varchar(48) NOT NULL CHECK (event_type IN (
    'ORDER_PLACED', 'COD_ORDER_CONFIRMATION', 'ONLINE_PAYMENT_SUCCESS',
    'PAYMENT_FAILURE', 'ORDER_STATUS_CHANGED', 'ORDER_CANCELLED'
  )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key varchar(180) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notification_events_user_created_idx ON notification_events(user_id, created_at);
CREATE INDEX notification_events_order_created_idx ON notification_events(order_id, created_at);
