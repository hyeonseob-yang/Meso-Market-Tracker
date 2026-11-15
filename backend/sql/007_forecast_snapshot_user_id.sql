-- NULL means system-generated (the daily automated archive) - only manually
-- saved snapshots (made by a logged-in visitor) get an owner.
-- ON DELETE changed to CASCADE in 010.
ALTER TABLE forecast_snapshot ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
