CREATE TABLE alert_subscription (
    id          SERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    webhook_url TEXT NOT NULL,
    name        TEXT NOT NULL,
    high        NUMERIC,
    low         NUMERIC,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, webhook_url)
);
