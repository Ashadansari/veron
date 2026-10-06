ALTER TABLE payment_records
  ADD COLUMN provider_transaction_id varchar(180);

CREATE INDEX payment_records_provider_transaction_idx
  ON payment_records(provider_transaction_id);

CREATE UNIQUE INDEX payment_records_provider_reference_unique
  ON payment_records(provider, provider_reference);
