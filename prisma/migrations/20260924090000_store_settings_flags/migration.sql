ALTER TABLE store_settings
  ADD COLUMN cod_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN store_active boolean NOT NULL DEFAULT true;
