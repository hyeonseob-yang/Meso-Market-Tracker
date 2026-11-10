import dataclasses
from unittest.mock import MagicMock, patch

import psycopg2
import psycopg2.errors
import pytest
from psycopg2.extras import Json

from database import (
    create_alert_subscription,
    delete_alert_subscription,
    delete_forecast_snapshot,
    get_alert_subscriptions,
    get_alert_subscriptions_for_user,
    get_forecast_cache,
    get_forecast_snapshots,
    get_forecast_training_prices,
    get_latest_prices,
    get_prices,
    insert_forecast_snapshot,
    insert_price,
    update_alert_subscription,
    upsert_forecast_cache,
)
from models import PriceInput

VALID_PRICE = PriceInput(
    average=450,
    buy100M=400,
    buy1B=390,
    buy10B=380,
    sell100M=500,
    sell1B=490,
    sell10B=480,
    notes="Test entry",
)


@patch("database._get_conn", side_effect=OSError("could not connect to server: Connection refused"))
def test_get_prices_raises_on_connection_failure(mock_get_conn):
    # Distinguishes a DB outage from genuinely empty data.
    with pytest.raises(RuntimeError, match="Unable to fetch prices"):
        get_prices()


@patch("database._get_conn", side_effect=OSError("could not connect to server: Connection refused"))
def test_insert_price_raises_on_connection_failure(mock_get_conn):
    # A swallowed failure here would look like a fake id, not an error.
    with pytest.raises(RuntimeError, match="Unable to record price"):
        insert_price(VALID_PRICE, "2026-09-30T00:00:00+00:00")


def test_insert_price_raises_if_insert_returns_no_row():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = None

    with patch("database._get_conn", return_value=conn):
        with pytest.raises(RuntimeError, match="Unable to record price"):
            insert_price(VALID_PRICE, "2026-09-30T00:00:00+00:00")


def test_insert_price_returns_id_on_success():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = (42,)

    with patch("database._get_conn", return_value=conn):
        assert insert_price(VALID_PRICE, "2026-09-30T00:00:00+00:00") == 42


@pytest.mark.parametrize("pg_error", [psycopg2.DataError, psycopg2.IntegrityError])
def test_insert_price_raises_value_error_on_invalid_data(pg_error):
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.execute.side_effect = pg_error("value too long")

    with patch("database._get_conn", return_value=conn):
        with pytest.raises(ValueError, match="Price data is invalid"):
            insert_price(VALID_PRICE, "2026-09-30T00:00:00+00:00")

    conn.rollback.assert_called_once()


def test_insert_price_still_raises_value_error_when_rollback_fails():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.execute.side_effect = psycopg2.DataError("value too long")
    conn.rollback.side_effect = psycopg2.OperationalError("server closed the connection unexpectedly")

    with patch("database._get_conn", return_value=conn):
        with pytest.raises(ValueError, match="Price data is invalid"):
            insert_price(VALID_PRICE, "2026-09-30T00:00:00+00:00")


def test_insert_price_upserts_on_duplicate_datetime():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = (42,)

    with patch("database._get_conn", return_value=conn):
        insert_price(VALID_PRICE, "2026-09-30T00:00:00+00:00")

    sql = cur.execute.call_args[0][0]
    assert "ON CONFLICT (datetime) DO UPDATE" in sql


def test_insert_price_stores_zero_average_as_null():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = (42,)
    zero_average_price = dataclasses.replace(VALID_PRICE, average=0)

    with patch("database._get_conn", return_value=conn):
        insert_price(zero_average_price, "2026-09-30T00:00:00+00:00")

    _, params = cur.execute.call_args[0]
    assert params[1] is None


def test_get_prices_with_no_range_has_no_where_clause():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchall.return_value = []

    with patch("database._get_conn", return_value=conn):
        get_prices()

    sql, params = cur.execute.call_args[0]
    assert "WHERE" not in sql
    assert params == [10000]


def test_get_prices_filters_by_since_and_until():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchall.return_value = []

    with patch("database._get_conn", return_value=conn):
        get_prices(since="2026-09-01T00:00:00+00:00", until="2026-10-01T00:00:00+00:00")

    sql, params = cur.execute.call_args[0]
    assert "datetime >= %s" in sql
    assert "datetime <= %s" in sql
    assert params == ["2026-09-01T00:00:00+00:00", "2026-10-01T00:00:00+00:00", 10000]


def test_get_prices_filters_by_since_only():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchall.return_value = []

    with patch("database._get_conn", return_value=conn):
        get_prices(since="2026-09-01T00:00:00+00:00")

    sql, params = cur.execute.call_args[0]
    assert "datetime >= %s" in sql
    assert "datetime <= %s" not in sql
    assert params == ["2026-09-01T00:00:00+00:00", 10000]


def test_get_latest_prices_orders_newest_first_with_limit():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchall.return_value = []

    with patch("database._get_conn", return_value=conn):
        get_latest_prices(limit=2)

    sql, params = cur.execute.call_args[0]
    assert "ORDER BY datetime DESC" in sql
    assert params == (2,)


def test_get_latest_prices_raises_on_connection_failure():
    with patch("database._get_conn", side_effect=OSError("could not connect to server: Connection refused")):
        with pytest.raises(RuntimeError, match="Unable to fetch the latest prices"):
            get_latest_prices()


def test_get_forecast_training_prices_excludes_manual_entries():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchall.return_value = []

    with patch("database._get_conn", return_value=conn):
        get_forecast_training_prices()

    sql, params = cur.execute.call_args[0]
    assert "notes != 'manual'" in sql
    assert "datetime >= %s" not in sql
    assert params == []


def test_get_forecast_training_prices_filters_by_since():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchall.return_value = []

    with patch("database._get_conn", return_value=conn):
        get_forecast_training_prices(since="2026-09-01T00:00:00+00:00")

    sql, params = cur.execute.call_args[0]
    assert "notes != 'manual'" in sql
    assert "datetime >= %s" in sql
    assert params == ["2026-09-01T00:00:00+00:00"]


def test_get_forecast_training_prices_raises_on_connection_failure():
    with patch("database._get_conn", side_effect=OSError("could not connect to server: Connection refused")):
        with pytest.raises(RuntimeError, match="Unable to fetch forecast training prices"):
            get_forecast_training_prices()


def test_upsert_forecast_cache_wraps_jsonb_columns():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value

    with patch("database._get_conn", return_value=conn):
        upsert_forecast_cache("AutoETS", {"sp": 24}, [{"datetime": "x"}], 240)

    sql, params = cur.execute.call_args[0]
    assert "ON CONFLICT (id) DO UPDATE" in sql
    assert params[0] == "AutoETS"
    assert isinstance(params[1], Json)
    assert isinstance(params[2], Json)
    assert params[3] == 240


def test_upsert_forecast_cache_passes_plain_none_when_model_params_absent():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value

    with patch("database._get_conn", return_value=conn):
        upsert_forecast_cache("NaiveForecaster", None, [], 0)

    _, params = cur.execute.call_args[0]
    assert params[1] is None


def test_upsert_forecast_cache_raises_on_connection_failure():
    with patch("database._get_conn", side_effect=OSError("could not connect to server: Connection refused")):
        with pytest.raises(RuntimeError, match="Unable to save the precomputed forecast"):
            upsert_forecast_cache("AutoETS", None, [], 0)


@pytest.mark.parametrize("pg_error", [psycopg2.DataError, psycopg2.IntegrityError])
def test_upsert_forecast_cache_raises_value_error_on_invalid_data(pg_error):
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.execute.side_effect = pg_error("value too long")

    with patch("database._get_conn", return_value=conn):
        with pytest.raises(ValueError, match="Forecast cache data is invalid"):
            upsert_forecast_cache("AutoETS", None, [], 0)

    conn.rollback.assert_called_once()


def test_get_forecast_cache_returns_none_when_no_row():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = None

    with patch("database._get_conn", return_value=conn):
        assert get_forecast_cache() is None


def test_get_forecast_cache_returns_forecast_when_row_present():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = ("AutoETS", {"sp": 24}, [{"datetime": "x"}], 240, "2026-10-13T06:09:45+00:00")

    with patch("database._get_conn", return_value=conn):
        forecast = get_forecast_cache()

    assert forecast.model == "AutoETS"
    assert forecast.model_params == {"sp": 24}
    assert forecast.points == [{"datetime": "x"}]
    assert forecast.history_count == 240
    assert forecast.updated_at == "2026-10-13T06:09:45+00:00"


def test_get_forecast_cache_raises_on_connection_failure():
    with patch("database._get_conn", side_effect=OSError("could not connect to server: Connection refused")):
        with pytest.raises(RuntimeError, match="Unable to fetch the precomputed forecast"):
            get_forecast_cache()


def test_insert_forecast_snapshot_returns_id_on_success():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = (7,)

    with patch("database._get_conn", return_value=conn):
        assert insert_forecast_snapshot(240, [{"datetime": "y"}], "AutoETS", None) == 7


def test_insert_forecast_snapshot_wraps_jsonb_columns():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = (1,)

    with patch("database._get_conn", return_value=conn):
        insert_forecast_snapshot(240, [{"datetime": "y"}], "AutoETS", {"sp": 24})

    _, params = cur.execute.call_args[0]
    model, model_params, points, history_count, user_id = params
    assert model == "AutoETS"
    assert isinstance(model_params, Json)
    assert isinstance(points, Json)
    assert history_count == 240
    assert user_id is None


def test_insert_forecast_snapshot_passes_user_id_through():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = (1,)

    with patch("database._get_conn", return_value=conn):
        insert_forecast_snapshot(240, [], "AutoETS", None, user_id="user-123")

    _, params = cur.execute.call_args[0]
    assert params[4] == "user-123"


def test_insert_forecast_snapshot_raises_if_insert_returns_no_row():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = None

    with patch("database._get_conn", return_value=conn):
        with pytest.raises(RuntimeError, match="Unable to save forecast snapshot"):
            insert_forecast_snapshot(0, [], "AutoETS", None)


def test_insert_forecast_snapshot_raises_on_connection_failure():
    with patch("database._get_conn", side_effect=OSError("could not connect to server: Connection refused")):
        with pytest.raises(RuntimeError, match="Unable to save forecast snapshot"):
            insert_forecast_snapshot(0, [], "AutoETS", None)


@pytest.mark.parametrize("pg_error", [psycopg2.DataError, psycopg2.IntegrityError])
def test_insert_forecast_snapshot_raises_value_error_on_invalid_data(pg_error):
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.execute.side_effect = pg_error("value too long")

    with patch("database._get_conn", return_value=conn):
        with pytest.raises(ValueError, match="Forecast snapshot data is invalid"):
            insert_forecast_snapshot(0, [], "AutoETS", None)

    conn.rollback.assert_called_once()


def test_get_forecast_snapshots_orders_by_created_at_desc_with_limit():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchall.return_value = []

    with patch("database._get_conn", return_value=conn):
        get_forecast_snapshots()

    sql, params = cur.execute.call_args[0]
    assert "ORDER BY created_at DESC" in sql
    assert params == (50,)


def test_get_forecast_snapshots_shows_only_userless_rows_when_logged_out():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchall.return_value = []

    with patch("database._get_conn", return_value=conn):
        get_forecast_snapshots(limit=50, user_id=None)

    sql, params = cur.execute.call_args[0]
    assert "user_id IS NULL" in sql
    assert "user_id = %s" not in sql
    assert params == (50,)


def test_get_forecast_snapshots_shows_userless_and_own_rows_when_logged_in():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchall.return_value = []

    with patch("database._get_conn", return_value=conn):
        get_forecast_snapshots(limit=50, user_id="user-123")

    sql, params = cur.execute.call_args[0]
    assert "user_id IS NULL OR user_id = %s" in sql
    assert params == ("user-123", 50)


def test_get_forecast_snapshots_raises_on_connection_failure():
    with patch("database._get_conn", side_effect=OSError("could not connect to server: Connection refused")):
        with pytest.raises(RuntimeError, match="Unable to fetch forecast snapshots"):
            get_forecast_snapshots()




def test_delete_forecast_snapshot_returns_true_when_row_deleted():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.rowcount = 1

    with patch("database._get_conn", return_value=conn):
        assert delete_forecast_snapshot(1) is True


def test_delete_forecast_snapshot_returns_false_when_no_row_deleted():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.rowcount = 0

    with patch("database._get_conn", return_value=conn):
        assert delete_forecast_snapshot(999) is False


def test_delete_forecast_snapshot_raises_on_connection_failure():
    with patch("database._get_conn", side_effect=OSError("could not connect to server: Connection refused")):
        with pytest.raises(RuntimeError, match="Unable to delete forecast snapshot"):
            delete_forecast_snapshot(1)


VALID_WEBHOOK_URL = "https://discord.com/api/webhooks/123/abc"


@pytest.mark.parametrize(
    "url",
    ["https://discord.com/api/webhooks/123/abc", "https://discordapp.com/api/webhooks/123/abc"],
)
def test_validate_webhook_url_accepts_real_discord_urls(url):
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = (1, url, "Test", 500.0, None)

    with patch("database._get_conn", return_value=conn):
        create_alert_subscription("user-123", url, "Test", 500.0, None)  # doesn't raise


def test_validate_webhook_url_rejects_garbage():
    with pytest.raises(ValueError, match="doesn't look like a Discord webhook URL"):
        create_alert_subscription("user-123", "https://evil.example.com/webhook", "Test", 500.0, None)


def test_validate_thresholds_rejects_both_null_on_create():
    with pytest.raises(ValueError, match="Set at least one of high or low"):
        create_alert_subscription("user-123", VALID_WEBHOOK_URL, "Test", None, None)


def test_validate_thresholds_rejects_both_null_on_update():
    with pytest.raises(ValueError, match="Set at least one of high or low"):
        update_alert_subscription("user-123", 1, "Test", None, None)


def test_create_alert_subscription_returns_subscription_on_success():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = (1, VALID_WEBHOOK_URL, "Test", 500.0, 300.0)

    with patch("database._get_conn", return_value=conn):
        result = create_alert_subscription("user-123", VALID_WEBHOOK_URL, "Test", 500.0, 300.0)

    assert result.id == 1
    assert result.webhook_url == VALID_WEBHOOK_URL
    assert result.name == "Test"
    assert result.high == 500.0
    assert result.low == 300.0


def test_create_alert_subscription_stores_under_given_user_id():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = (1, VALID_WEBHOOK_URL, "Test", 500.0, None)

    with patch("database._get_conn", return_value=conn):
        create_alert_subscription("user-123", VALID_WEBHOOK_URL, "Test", 500.0, None)

    _, params = cur.execute.call_args[0]
    assert params[0] == "user-123"


def test_create_alert_subscription_raises_clear_error_on_duplicate_webhook():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.execute.side_effect = psycopg2.errors.UniqueViolation("duplicate key value violates unique constraint")

    with patch("database._get_conn", return_value=conn):
        with pytest.raises(ValueError, match="You already have an alert on that webhook"):
            create_alert_subscription("user-123", VALID_WEBHOOK_URL, "Test", 500.0, None)

    conn.rollback.assert_called_once()


@pytest.mark.parametrize("pg_error", [psycopg2.DataError, psycopg2.IntegrityError])
def test_create_alert_subscription_raises_value_error_on_other_invalid_data(pg_error):
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.execute.side_effect = pg_error("value too long")

    with patch("database._get_conn", return_value=conn):
        with pytest.raises(ValueError, match="Alert subscription data is invalid"):
            create_alert_subscription("user-123", VALID_WEBHOOK_URL, "Test", 500.0, None)

    conn.rollback.assert_called_once()


def test_create_alert_subscription_raises_on_connection_failure():
    with patch("database._get_conn", side_effect=OSError("could not connect to server: Connection refused")):
        with pytest.raises(RuntimeError, match="Unable to create the alert subscription"):
            create_alert_subscription("user-123", VALID_WEBHOOK_URL, "Test", 500.0, None)


def test_update_alert_subscription_returns_none_when_not_found():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = None

    with patch("database._get_conn", return_value=conn):
        assert update_alert_subscription("user-123", 999, "Test", 500.0, None) is None


def test_update_alert_subscription_returns_none_for_someone_elses_row():
    # Same id, wrong user_id - the SQL's WHERE clause excludes it, so this
    # looks identical to "not found" from the caller's perspective.
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = None

    with patch("database._get_conn", return_value=conn):
        result = update_alert_subscription("wrong-user", 1, "Test", 500.0, None)

    assert result is None
    _, params = cur.execute.call_args[0]
    assert params[-1] == "wrong-user"


def test_update_alert_subscription_returns_updated_row_on_success():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = (1, VALID_WEBHOOK_URL, "New name", 600.0, None)

    with patch("database._get_conn", return_value=conn):
        result = update_alert_subscription("user-123", 1, "New name", 600.0, None)

    assert result.name == "New name"
    assert result.high == 600.0


def test_delete_alert_subscription_returns_true_when_row_deleted():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.rowcount = 1

    with patch("database._get_conn", return_value=conn):
        assert delete_alert_subscription("user-123", 1) is True


def test_delete_alert_subscription_returns_false_when_no_row_deleted():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.rowcount = 0

    with patch("database._get_conn", return_value=conn):
        assert delete_alert_subscription("user-123", 999) is False


def test_delete_alert_subscription_does_not_remove_someone_elses_row():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.rowcount = 0  # the WHERE clause excludes it, same as a bad id

    with patch("database._get_conn", return_value=conn):
        assert delete_alert_subscription("wrong-user", 1) is False

    _, params = cur.execute.call_args[0]
    assert params == (1, "wrong-user")


def test_get_alert_subscriptions_for_user_filters_by_user_id():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchall.return_value = [(1, VALID_WEBHOOK_URL, "Test", None, None)]

    with patch("database._get_conn", return_value=conn):
        result = get_alert_subscriptions_for_user("user-123")

    assert len(result) == 1
    sql, params = cur.execute.call_args[0]
    assert "WHERE user_id = %s" in sql
    assert params == ("user-123",)


def test_get_alert_subscriptions_returns_everyone_with_no_filter():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchall.return_value = [(VALID_WEBHOOK_URL, "Test", 500.0, None)]

    with patch("database._get_conn", return_value=conn):
        result = get_alert_subscriptions()

    assert result == [{"webhook_url": VALID_WEBHOOK_URL, "name": "Test", "high": 500.0, "low": None}]
    sql = cur.execute.call_args[0][0]
    assert "WHERE" not in sql
