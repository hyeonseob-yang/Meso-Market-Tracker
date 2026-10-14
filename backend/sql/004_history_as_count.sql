ALTER TABLE forecast_cache DROP COLUMN history;
ALTER TABLE forecast_cache ADD COLUMN history_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE forecast_snapshot DROP COLUMN history;
ALTER TABLE forecast_snapshot ADD COLUMN history_count INTEGER NOT NULL DEFAULT 0;
