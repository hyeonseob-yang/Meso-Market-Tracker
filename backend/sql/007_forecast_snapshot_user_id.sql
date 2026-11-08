-- NULL means system-generated (the daily automated archive) - only manually
-- saved snapshots (made by a logged-in visitor) get an owner.
ALTER TABLE forecast_snapshot ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
