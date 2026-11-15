-- A deleted user's Saved Snapshots are deleted with them; SET NULL turned
-- them into ownerless rows indistinguishable from Archived Snapshots.
BEGIN;
ALTER TABLE forecast_snapshot DROP CONSTRAINT forecast_snapshot_user_id_fkey;
ALTER TABLE forecast_snapshot
    ADD CONSTRAINT forecast_snapshot_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
COMMIT;
