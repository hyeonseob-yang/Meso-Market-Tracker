import json
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app import app
from models import PriceRecord

PRICES_QUERY = """
query {
  prices {
    id
    datetime
    average
    buy100M
    buy1B
    buy10B
    sell100M
    sell1B
    sell10B
    notes
  }
}
"""

SAMPLE_RECORD = PriceRecord(
    id=1,
    datetime="2024-01-15T12:00:00",
    average=1050,
    buy100M=1000,
    buy1B=990,
    buy10B=980,
    sell100M=1100,
    sell1B=1090,
    sell10B=1080,
    notes="Test entry",
)

RECORD_PRICE_MUTATION = """
mutation RecordPrice($price: PriceInput!) {
  recordPrice(price: $price)
}
"""

TEST_SECRET = "test-secret"

VALID_PRICE_VARS = {
    "price": {
        "average": 1050,
        "buy100M": 1000,
        "buy1B": 990,
        "buy10B": 980,
        "sell100M": 1100,
        "sell1B": 1090,
        "sell10B": 1080,
        "notes": "Test entry",
    }
}


TEST_SNAPSHOT_SECRET = "test-snapshot-secret"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("RECORD_PRICE_SECRET", TEST_SECRET)
    monkeypatch.setenv("FORECAST_SNAPSHOT_SECRET", TEST_SNAPSHOT_SECRET)
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def gql(client, query, variables=None, headers=None):
    default_headers = {"x-record-price-secret": TEST_SECRET}
    return client.post(
        "/price",
        data=json.dumps({"query": query, "variables": variables or {}}),
        content_type="application/json",
        headers={**default_headers, **(headers or {})},
    )


@patch("schema.insert_price", return_value=42)
def test_record_price_mutation_returns_id(mock_insert, client):
    response = gql(client, RECORD_PRICE_MUTATION, VALID_PRICE_VARS)
    assert response.status_code == 200
    body = json.loads(response.data)
    assert body["data"]["recordPrice"] == "42"


@patch("schema.insert_price", return_value=42)
def test_record_price_calls_insert_with_correct_fields(mock_insert, client):
    gql(client, RECORD_PRICE_MUTATION, VALID_PRICE_VARS)
    mock_insert.assert_called_once()
    call_arg = mock_insert.call_args[0][0]
    assert call_arg.average == 1050
    assert call_arg.buy100M == 1000
    assert call_arg.notes == "Test entry"


@patch("schema.insert_price", return_value=42)
def test_record_price_stamps_server_time_when_datetime_omitted(mock_insert, client):
    before = datetime.now(timezone.utc)
    gql(client, RECORD_PRICE_MUTATION, VALID_PRICE_VARS)
    after = datetime.now(timezone.utc)

    occurred_at = mock_insert.call_args[0][1]
    parsed = datetime.fromisoformat(occurred_at)
    assert before <= parsed <= after


@patch("schema.insert_price", return_value=42)
def test_record_price_uses_client_supplied_datetime(mock_insert, client):
    # Lets a reading keep its original time across a retry, or when
    # backfilling from a local backup, instead of always being "now".
    vars = {"price": {**VALID_PRICE_VARS["price"], "datetime": "2024-01-15T12:00:00+00:00"}}
    gql(client, RECORD_PRICE_MUTATION, vars)
    assert mock_insert.call_args[0][1] == "2024-01-15T12:00:00+00:00"


@patch("schema.insert_price", return_value=1)
def test_record_price_rejects_invalid_datetime(mock_insert, client):
    vars = {"price": {**VALID_PRICE_VARS["price"], "datetime": "not-a-date"}}
    response = gql(client, RECORD_PRICE_MUTATION, vars)
    body = json.loads(response.data)
    assert body["data"] is None
    assert any("Invalid datetime" in e["message"] for e in body["errors"])


@patch("schema.insert_price", return_value=1)
def test_record_price_rejects_missing_secret(mock_insert, client):
    response = gql(client, RECORD_PRICE_MUTATION, VALID_PRICE_VARS, headers={"x-record-price-secret": ""})
    body = json.loads(response.data)
    assert body["data"] is None
    assert any("Invalid or missing credentials" in e["message"] for e in body["errors"])
    mock_insert.assert_not_called()


@patch("schema.insert_price", return_value=1)
def test_record_price_rejects_wrong_secret(mock_insert, client):
    response = gql(client, RECORD_PRICE_MUTATION, VALID_PRICE_VARS, headers={"x-record-price-secret": "nope"})
    body = json.loads(response.data)
    assert body["data"] is None
    assert any("Invalid or missing credentials" in e["message"] for e in body["errors"])
    mock_insert.assert_not_called()


@patch("schema.insert_price", return_value=1)
def test_record_price_fails_closed_when_unconfigured(mock_insert, client, monkeypatch):
    # If RECORD_PRICE_SECRET isn't set at all, refuse every write rather
    # than leaving the endpoint open by accident.
    monkeypatch.delenv("RECORD_PRICE_SECRET", raising=False)
    response = gql(client, RECORD_PRICE_MUTATION, VALID_PRICE_VARS)
    body = json.loads(response.data)
    assert body["data"] is None
    assert any("not configured" in e["message"] for e in body["errors"])
    mock_insert.assert_not_called()
    mock_insert.assert_not_called()


@patch("schema.get_prices", return_value=[SAMPLE_RECORD])
def test_prices_query_returns_records(mock_get, client):
    response = gql(client, PRICES_QUERY)
    assert response.status_code == 200
    body = json.loads(response.data)
    records = body["data"]["prices"]
    assert len(records) == 1
    assert records[0]["id"] == 1
    assert records[0]["average"] == 1050
    assert records[0]["notes"] == "Test entry"


@patch("schema.get_prices", return_value=[])
def test_prices_query_returns_empty_list(mock_get, client):
    response = gql(client, PRICES_QUERY)
    assert response.status_code == 200
    body = json.loads(response.data)
    assert body["data"]["prices"] == []


LATEST_PRICES_QUERY = """
query LatestPrices($limit: Int!) {
  latestPrices(limit: $limit) {
    id
    datetime
    average
  }
}
"""


@patch("schema.get_latest_prices", return_value=[SAMPLE_RECORD])
def test_latest_prices_query_passes_limit_through(mock_get, client):
    response = gql(client, LATEST_PRICES_QUERY, {"limit": 2})
    assert response.status_code == 200
    body = json.loads(response.data)
    assert body["data"]["latestPrices"][0]["id"] == 1
    mock_get.assert_called_once_with(2)


RANGED_PRICES_QUERY = """
query Prices($since: String, $until: String) {
  prices(since: $since, until: $until) {
    id
  }
}
"""


@patch("schema.get_prices", return_value=[])
def test_prices_query_passes_since_and_until_through(mock_get, client):
    vars = {"since": "2026-09-01T00:00:00+00:00", "until": "2026-10-01T00:00:00+00:00"}
    gql(client, RANGED_PRICES_QUERY, vars)
    mock_get.assert_called_once_with(10000, vars["since"], vars["until"])


def test_prices_query_rejects_invalid_since(client):
    response = gql(client, RANGED_PRICES_QUERY, {"since": "not-a-date"})
    body = json.loads(response.data)
    assert body["data"] is None
    assert any("Invalid since" in e["message"] for e in body["errors"])


@patch("schema.get_prices", side_effect=RuntimeError("Unable to fetch prices right now."))
def test_prices_query_surfaces_database_failure(mock_get, client):
    # A DB outage must not look like "zero prices" to the client - it
    # should come back as an explicit error, not a quiet empty success.
    response = gql(client, PRICES_QUERY)
    assert response.status_code == 200
    body = json.loads(response.data)
    assert body["data"] is None
    assert any("Unable to fetch prices" in e["message"] for e in body["errors"])


@patch("schema.insert_price", side_effect=RuntimeError("Unable to record price right now."))
def test_record_price_surfaces_database_failure(mock_insert, client):
    # 503, not GraphQL's default 200 - the Collector's retry logic keys off
    # HTTP status, and a database failure here is worth retrying.
    response = gql(client, RECORD_PRICE_MUTATION, VALID_PRICE_VARS)
    assert response.status_code == 503
    body = json.loads(response.data)
    assert body["data"] is None
    assert any("Unable to record price" in e["message"] for e in body["errors"])


@patch("schema.insert_price", side_effect=ValueError("Price data is invalid."))
def test_record_price_does_not_retry_invalid_data(mock_insert, client):
    # Bad data stays 200-with-errors - retrying the same payload can't help.
    response = gql(client, RECORD_PRICE_MUTATION, VALID_PRICE_VARS)
    assert response.status_code == 200
    body = json.loads(response.data)
    assert body["data"] is None
    assert any("Price data is invalid" in e["message"] for e in body["errors"])


@patch("schema.insert_price", return_value=1)
def test_record_price_rejects_zero_price(mock_insert, client):
    vars = {**VALID_PRICE_VARS, "price": {**VALID_PRICE_VARS["price"], "average": 0}}
    response = gql(client, RECORD_PRICE_MUTATION, vars)
    body = json.loads(response.data)
    assert body["data"] is None
    assert any("average" in e["message"] for e in body["errors"])
    mock_insert.assert_not_called()


@patch("schema.insert_price", return_value=1)
def test_record_price_rejects_negative_price(mock_insert, client):
    vars = {**VALID_PRICE_VARS, "price": {**VALID_PRICE_VARS["price"], "sell10B": -100}}
    response = gql(client, RECORD_PRICE_MUTATION, vars)
    body = json.loads(response.data)
    assert body["data"] is None
    assert any("sell10B" in e["message"] for e in body["errors"])
    mock_insert.assert_not_called()


def test_health_query(client):
    response = gql(client, "{ health }")
    assert response.status_code == 200
    body = json.loads(response.data)
    assert body["data"]["health"] == "ok"


FORECAST_QUERY = """
query { forecast { model points } }
"""

FORECAST_SNAPSHOTS_QUERY = """
query { forecastSnapshots { id model points } }
"""

RECORD_FORECAST_SNAPSHOT_MUTATION = """
mutation Save($historyCount: Int!, $points: JSON!, $model: String!) {
  recordForecastSnapshot(historyCount: $historyCount, points: $points, model: $model) {
    id createdAt model points
  }
}
"""

DELETE_FORECAST_SNAPSHOT_MUTATION = """
mutation Delete($id: Int!) {
  deleteForecastSnapshot(id: $id)
}
"""

SAMPLE_FORECAST = SimpleNamespace(
    model="AutoETS",
    model_params={"sp": 24},
    points=[{"datetime": "2026-10-13T00:00:00", "predicted": 100.0, "lower": 90.0, "upper": 110.0}],
)

SAMPLE_SNAPSHOT_RECORD = SimpleNamespace(
    id=1,
    created_at="2026-10-13T00:00:00+00:00",
    model="AutoETS",
    model_params={"sp": 24},
    history_count=240,
    points=SAMPLE_FORECAST.points,
)


@patch("schema.get_forecast_cache", return_value=SAMPLE_FORECAST)
def test_forecast_query_returns_cached_forecast(mock_get, client):
    response = gql(client, FORECAST_QUERY)
    assert response.status_code == 200
    body = json.loads(response.data)
    assert body["data"]["forecast"]["model"] == "AutoETS"
    assert len(body["data"]["forecast"]["points"]) == 1


@patch("schema.get_forecast_cache", return_value=None)
def test_forecast_query_returns_null_before_first_precompute(mock_get, client):
    response = gql(client, FORECAST_QUERY)
    assert response.status_code == 200
    body = json.loads(response.data)
    assert body["data"]["forecast"] is None


@patch("schema.get_forecast_snapshots", return_value=[SAMPLE_SNAPSHOT_RECORD])
def test_forecast_snapshots_query_returns_records(mock_get, client):
    response = gql(client, FORECAST_SNAPSHOTS_QUERY)
    assert response.status_code == 200
    body = json.loads(response.data)
    assert body["data"]["forecastSnapshots"][0]["id"] == 1


@patch("schema.get_forecast_snapshots", return_value=[])
def test_forecast_snapshots_query_returns_empty_list(mock_get, client):
    response = gql(client, FORECAST_SNAPSHOTS_QUERY)
    assert response.status_code == 200
    body = json.loads(response.data)
    assert body["data"]["forecastSnapshots"] == []


def _gql_snapshot_write(client, query, variables, secret=TEST_SNAPSHOT_SECRET):
    return client.post(
        "/price",
        data=json.dumps({"query": query, "variables": variables}),
        content_type="application/json",
        headers={"x-forecast-snapshot-secret": secret},
    )


@patch("schema.insert_forecast_snapshot", return_value=1)
def test_record_forecast_snapshot_returns_record(mock_insert, client):
    vars = {"historyCount": 240, "points": [], "model": "AutoETS"}
    response = _gql_snapshot_write(client, RECORD_FORECAST_SNAPSHOT_MUTATION, vars)
    body = json.loads(response.data)
    assert body["data"]["recordForecastSnapshot"]["id"] == 1
    assert body["data"]["recordForecastSnapshot"]["model"] == "AutoETS"


@patch("schema.insert_forecast_snapshot", return_value=1)
def test_record_forecast_snapshot_rejects_missing_secret(mock_insert, client):
    vars = {"historyCount": 0, "points": [], "model": "AutoETS"}
    response = _gql_snapshot_write(client, RECORD_FORECAST_SNAPSHOT_MUTATION, vars, secret="")
    body = json.loads(response.data)
    assert body["data"] is None
    assert any("Invalid or missing credentials" in e["message"] for e in body["errors"])
    mock_insert.assert_not_called()


@patch("schema.insert_forecast_snapshot", return_value=1)
def test_record_forecast_snapshot_rejects_wrong_secret(mock_insert, client):
    vars = {"historyCount": 0, "points": [], "model": "AutoETS"}
    response = _gql_snapshot_write(client, RECORD_FORECAST_SNAPSHOT_MUTATION, vars, secret="nope")
    body = json.loads(response.data)
    assert body["data"] is None
    assert any("Invalid or missing credentials" in e["message"] for e in body["errors"])
    mock_insert.assert_not_called()


@patch("schema.insert_forecast_snapshot", return_value=1)
def test_record_forecast_snapshot_fails_closed_when_unconfigured(mock_insert, client, monkeypatch):
    monkeypatch.delenv("FORECAST_SNAPSHOT_SECRET", raising=False)
    vars = {"historyCount": 0, "points": [], "model": "AutoETS"}
    response = _gql_snapshot_write(client, RECORD_FORECAST_SNAPSHOT_MUTATION, vars)
    body = json.loads(response.data)
    assert body["data"] is None
    assert any("not configured" in e["message"] for e in body["errors"])
    mock_insert.assert_not_called()


@patch("schema.insert_forecast_snapshot", side_effect=RuntimeError("Unable to save forecast snapshot right now."))
def test_record_forecast_snapshot_surfaces_database_failure(mock_insert, client):
    vars = {"historyCount": 0, "points": [], "model": "AutoETS"}
    response = _gql_snapshot_write(client, RECORD_FORECAST_SNAPSHOT_MUTATION, vars)
    body = json.loads(response.data)
    assert body["data"] is None
    assert any("Unable to save forecast snapshot" in e["message"] for e in body["errors"])


@patch("schema.db_delete_forecast_snapshot", return_value=True)
def test_delete_forecast_snapshot_returns_true(mock_delete, client):
    response = _gql_snapshot_write(client, DELETE_FORECAST_SNAPSHOT_MUTATION, {"id": 1})
    body = json.loads(response.data)
    assert body["data"]["deleteForecastSnapshot"] is True


@patch("schema.db_delete_forecast_snapshot", return_value=False)
def test_delete_forecast_snapshot_returns_false_when_not_found(mock_delete, client):
    response = _gql_snapshot_write(client, DELETE_FORECAST_SNAPSHOT_MUTATION, {"id": 999})
    body = json.loads(response.data)
    assert body["data"]["deleteForecastSnapshot"] is False


@patch("schema.db_delete_forecast_snapshot", return_value=True)
def test_delete_forecast_snapshot_rejects_wrong_secret(mock_delete, client):
    response = _gql_snapshot_write(client, DELETE_FORECAST_SNAPSHOT_MUTATION, {"id": 1}, secret="nope")
    body = json.loads(response.data)
    assert body["data"] is None
    assert any("Invalid or missing credentials" in e["message"] for e in body["errors"])
    mock_delete.assert_not_called()
