import json
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

VALID_PRICE_VARS = {
    "price": {
        "datetime": "2024-01-15T12:00:00",
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


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def gql(client, query, variables=None):
    return client.post(
        "/price",
        data=json.dumps({"query": query, "variables": variables or {}}),
        content_type="application/json",
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


@patch("schema.insert_price", return_value=1)
def test_record_price_rejects_invalid_datetime(mock_insert, client):
    vars = {**VALID_PRICE_VARS, "price": {**VALID_PRICE_VARS["price"], "datetime": "not-a-date"}}
    response = gql(client, RECORD_PRICE_MUTATION, vars)
    body = json.loads(response.data)
    assert body["data"] is None
    assert any("Invalid datetime" in e["message"] for e in body["errors"])
    mock_insert.assert_not_called()


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
