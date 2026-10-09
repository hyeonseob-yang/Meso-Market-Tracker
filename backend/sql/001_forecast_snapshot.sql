-- history/points are frozen JSONB, read/written as one unit.
-- Predicted-vs-actual is not stored - compute on read via prices(since, until).

CREATE TABLE forecast_snapshot (
    id            SERIAL PRIMARY KEY,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    horizon_days  INTEGER NOT NULL,
    model         TEXT NOT NULL,
    model_params  JSONB,
    history       JSONB NOT NULL,
    points        JSONB NOT NULL
);

CREATE INDEX idx_forecast_snapshot_created_at ON forecast_snapshot (created_at DESC);
