from unittest.mock import patch

import pytest

from app import app

TEST_SECRET = "test-watchdog-secret"

SAMPLE_SUBSCRIPTIONS = [
    {"webhook_url": "https://discord.com/api/webhooks/123/abc", "name": "Test", "high": 500.0, "low": None},
]


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("WATCHDOG_SECRET", TEST_SECRET)
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def get(client, headers=None):
    return client.get("/internal/alert-subscriptions", headers=headers or {})


def test_rejects_missing_secret(client):
    response = get(client)
    assert response.status_code == 403


def test_rejects_wrong_secret(client):
    response = get(client, {"x-watchdog-secret": "nope"})
    assert response.status_code == 403


def test_fails_closed_when_unconfigured(client, monkeypatch):
    monkeypatch.delenv("WATCHDOG_SECRET", raising=False)
    response = get(client, {"x-watchdog-secret": TEST_SECRET})
    assert response.status_code == 403


@patch("app.get_alert_subscriptions", return_value=SAMPLE_SUBSCRIPTIONS)
def test_correct_secret_returns_every_subscription(mock_get, client):
    response = get(client, {"x-watchdog-secret": TEST_SECRET})
    assert response.status_code == 200
    assert response.json == SAMPLE_SUBSCRIPTIONS
    mock_get.assert_called_once_with()
