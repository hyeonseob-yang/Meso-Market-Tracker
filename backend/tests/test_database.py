from unittest.mock import MagicMock, patch

import pytest
from psycopg2.extras import Json

from database import (
    delete_forecast_snapshot,
    get_forecast_cache,
    get_forecast_snapshots,
    get_forecast_training_prices,
    get_latest_prices,
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
        upsert_forecast_cache("AutoETS", {"sp": 24}, [{"datetime": "x"}])

    sql, params = cur.execute.call_args[0]
    assert "ON CONFLICT (id) DO UPDATE" in sql
    assert params[0] == "AutoETS"
    assert isinstance(params[1], Json)
    assert isinstance(params[2], Json)


def test_upsert_forecast_cache_passes_plain_none_when_model_params_absent():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value

    with patch("database._get_conn", return_value=conn):
        upsert_forecast_cache("NaiveForecaster", None, [])

    _, params = cur.execute.call_args[0]
    assert params[1] is None


def test_upsert_forecast_cache_raises_on_connection_failure():
    with patch("database._get_conn", side_effect=OSError("could not connect to server: Connection refused")):
        with pytest.raises(RuntimeError, match="Unable to save the precomputed forecast"):
            upsert_forecast_cache("AutoETS", None, [])


def test_get_forecast_cache_returns_none_when_no_row():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = None

    with patch("database._get_conn", return_value=conn):
        assert get_forecast_cache() is None


def test_get_forecast_cache_returns_forecast_when_row_present():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = ("AutoETS", {"sp": 24}, [{"datetime": "x"}], "2026-10-13T06:09:45+00:00")

    with patch("database._get_conn", return_value=conn):
        forecast = get_forecast_cache()

    assert forecast.model == "AutoETS"
    assert forecast.model_params == {"sp": 24}
    assert forecast.points == [{"datetime": "x"}]
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
        assert insert_forecast_snapshot([{"datetime": "x"}], [{"datetime": "y"}], "AutoETS", None) == 7


def test_insert_forecast_snapshot_wraps_jsonb_columns():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = (1,)

    with patch("database._get_conn", return_value=conn):
        insert_forecast_snapshot([{"datetime": "x"}], [{"datetime": "y"}], "AutoETS", {"sp": 24})

    _, params = cur.execute.call_args[0]
    model, model_params, history, points = params
    assert model == "AutoETS"
    assert isinstance(model_params, Json)
    assert isinstance(history, Json)
    assert isinstance(points, Json)


def test_insert_forecast_snapshot_raises_if_insert_returns_no_row():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = None

    with patch("database._get_conn", return_value=conn):
        with pytest.raises(RuntimeError, match="Unable to save forecast snapshot"):
            insert_forecast_snapshot([], [], "AutoETS", None)


def test_insert_forecast_snapshot_raises_on_connection_failure():
    with patch("database._get_conn", side_effect=OSError("could not connect to server: Connection refused")):
        with pytest.raises(RuntimeError, match="Unable to save forecast snapshot"):
            insert_forecast_snapshot([], [], "AutoETS", None)


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
