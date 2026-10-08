from unittest.mock import MagicMock, patch

import pytest

from database import get_latest_prices, get_prices, insert_price
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
