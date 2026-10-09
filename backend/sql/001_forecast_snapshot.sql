-- Applied 2026-10-09. There's no migration tool wired up (price itself was
-- created directly in Supabase, untracked) - this file exists so schema
-- changes going forward are at least recorded in the repo, even though
-- applying it is still a manual psql/psycopg2 step for now.
--
-- history/points are frozen JSONB blobs, not normalized child tables -
-- always read/written as one whole unit, never queried per-point.
-- "predicted vs. actual" comparison is NOT stored here - it's computed on
-- read by calling the existing `prices(since, until)` query against
-- points[0].datetime..points[-1].datetime, so the comparison always
-- reflects live data rather than a second frozen copy.

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
