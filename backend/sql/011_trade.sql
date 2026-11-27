-- A user's own record of a meso trade (see GLOSSARY.md: Trade). Amount is in
-- 100M-meso units: Amounts are always whole 100Ms and GraphQL Int is 32-bit.
-- Price is Maple Points per 100M, before any fee; Fee/Net/Total are derived.
CREATE TABLE trade (
    id           SERIAL PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    side         TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    amount_100m  INTEGER NOT NULL CHECK (amount_100m > 0),
    price        INTEGER NOT NULL CHECK (price > 0),
    traded_at    TIMESTAMPTZ NOT NULL,
    note         TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trade_user_traded_at ON trade (user_id, traded_at DESC);

ALTER TABLE trade ENABLE ROW LEVEL SECURITY;
