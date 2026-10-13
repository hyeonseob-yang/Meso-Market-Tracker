CREATE TABLE forecast_cache (
    id            SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    model         TEXT NOT NULL,
    model_params  JSONB,
    points        JSONB NOT NULL
);
