ALTER TABLE forecast_cache ADD COLUMN history JSONB NOT NULL DEFAULT '[]'::jsonb;
