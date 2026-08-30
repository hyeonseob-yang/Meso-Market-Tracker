from unittest.mock import patch

import pytest

from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


VALID_PRICE = {
    "datetime": "2024-01-15T12:00:00",
    "average": "1050",
    "buy100M": "1000",
    "buy1B": "990",
    "buy10B": "980",
    "sell100M": "1100",
    "sell1B": "1090",
    "sell10B": "1080",
    "notes": "Test entry",
}


@patch("app.insert_price", return_value=1)
def test_post_price_returns_inserted_id(mock_insert, client):
    response = client.post("/price", data=VALID_PRICE)
    assert response.status_code == 200
    assert b"Inserted id: 1" in response.data


@patch("app.insert_price", return_value=1)
def test_post_price_calls_insert_with_form_data(mock_insert, client):
    client.post("/price", data=VALID_PRICE)
    mock_insert.assert_called_once()
    call_arg = mock_insert.call_args[0][0]
    assert call_arg["average"] == "1050"
    assert call_arg["buy100M"] == "1000"


@patch("app.insert_price", return_value=None)
def test_post_price_handles_insert_failure(mock_insert, client):
    response = client.post("/price", data=VALID_PRICE)
    assert response.status_code == 200
    assert b"Inserted id: None" in response.data
