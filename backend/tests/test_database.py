from unittest.mock import MagicMock, patch

import psycopg2
import pytest
from psycopg2.extras import Json

from database import (
    delete_forecast_snapshot,
    get_forecast_cache,
    get_forecast_snapshots,
    get_forecast_training_prices,
    get_latest_prices,
    get_recent_training_prices,
    get_prices,
    insert_forecast_snapshot,
    insert_price,
    upsert_forecast_cache,
)
from models import PriceInput

VALID_PRICE = PriceInput(
    average=1050,
    buy100M=1000,
    buy1B=990,
    buy10B=980,
    sell100M=1100,
    sell1B=1090,
    sell10B=1080,
    notes="Test entry",
)


@patch("database._get_conn", side_effect=OSError("could not connect to server: Connection refused"))
def test_get_prices_raises_on_connection_failure(mock_get_conn):
    # Before this fix, a DB outage was swallowed and an empty list returned
    # - indistinguishable from "there are genuinely no prices yet".
    with pytest.raises(RuntimeError, match="Unable to fetch prices"):
        get_prices()


@patch("database._get_conn", side_effect=OSError("could not connect to server: Connection refused"))
def test_insert_price_raises_on_connection_failure(mock_get_conn):
    # Same bug, mutation side - this used to return None silently, which
    # record_price then stringified into a fake-looking id of "None".
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


def test_get_recent_training_prices_excludes_manual_orders_desc_with_limit():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchall.return_value = []

    with patch("database._get_conn", return_value=conn):
        get_recent_training_prices(before="2026-10-13T00:00:00+00:00", limit=5)

    sql, params = cur.execute.call_args[0]
    assert "notes != 'manual'" in sql
    assert "datetime <= %s" in sql
    assert "ORDER BY datetime DESC" in sql
    assert params == ("2026-10-13T00:00:00+00:00", 5)


def test_get_recent_training_prices_returns_oldest_first():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    # DB returns newest-first (per the DESC query) - function should flip it.
    cur.fetchall.return_value = [
        (2, "2026-10-13T02:00:00", 101, 1, 1, 1, 1, 1, 1, ""),
        (1, "2026-10-13T01:00:00", 100, 1, 1, 1, 1, 1, 1, ""),
    ]

    with patch("database._get_conn", return_value=conn):
        records = get_recent_training_prices(before="2026-10-13T03:00:00", limit=2)

    assert [r.id for r in records] == [1, 2]


def test_get_recent_training_prices_raises_on_connection_failure():
    with patch("database._get_conn", side_effect=OSError("could not connect to server: Connection refused")):
        with pytest.raises(RuntimeError, match="Unable to fetch recent training prices"):
            get_recent_training_prices(before="2026-10-13T00:00:00+00:00", limit=5)


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
    model, model_params, points, history_count = params
    assert model == "AutoETS"
    assert isinstance(model_params, Json)
    assert isinstance(points, Json)
    assert history_count == 240


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


def test_get_forecast_snapshots_orders_by_created_at_desc_with_limit():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchall.return_value = []

    with patch("database._get_conn", return_value=conn):
        get_forecast_snapshots()

    sql, params = cur.execute.call_args[0]
    assert "ORDER BY created_at DESC" in sql
    assert params == (50,)


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
