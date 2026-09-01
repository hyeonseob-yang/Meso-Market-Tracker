import json
from unittest.mock import patch

import pytest

from app import app

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
    assert call_arg["average"] == 1050
    assert call_arg["buy100M"] == 1000
    assert call_arg["notes"] == "Test entry"


def test_health_query(client):
    response = gql(client, "{ health }")
    assert response.status_code == 200
    body = json.loads(response.data)
    assert body["data"]["health"] == "ok"
