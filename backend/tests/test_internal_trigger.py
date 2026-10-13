from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app import app

TEST_SECRET = "test-trigger-secret"

SAMPLE_FORECAST = SimpleNamespace(model="AutoETS", model_params={"sp": 24}, points=[{"datetime": "x"}])


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("INTERNAL_TRIGGER_SECRET", TEST_SECRET)
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def post(client, body):
    return client.post("/internal/trigger", json=body)


def test_rejects_missing_secret(client):
    response = post(client, {"action": "precompute"})
    assert response.status_code == 403


def test_rejects_wrong_secret(client):
    response = post(client, {"secret": "nope", "action": "precompute"})
    assert response.status_code == 403


def test_fails_closed_when_unconfigured(client, monkeypatch):
    monkeypatch.delenv("INTERNAL_TRIGGER_SECRET", raising=False)
    response = post(client, {"secret": TEST_SECRET, "action": "precompute"})
    assert response.status_code == 403


def test_rejects_unknown_action(client):
    response = post(client, {"secret": TEST_SECRET, "action": "bogus"})
    assert response.status_code == 400


@patch("app.upsert_forecast_cache")
@patch("forecasting.compute_forecast", return_value=SAMPLE_FORECAST)
def test_precompute_action_calls_compute_and_upsert(mock_compute, mock_upsert, client):
    response = post(client, {"secret": TEST_SECRET, "action": "precompute"})
    assert response.status_code == 200
    mock_compute.assert_called_once()
    mock_upsert.assert_called_once_with("AutoETS", {"sp": 24}, [{"datetime": "x"}])


@patch("app.insert_forecast_snapshot")
@patch("app.get_forecast_training_prices", return_value=[])
@patch("app.get_forecast_cache", return_value=SAMPLE_FORECAST)
def test_snapshot_daily_action_archives_the_cache(mock_cache, mock_training, mock_insert, client):
    response = post(client, {"secret": TEST_SECRET, "action": "snapshot_daily"})
    assert response.status_code == 200
    mock_insert.assert_called_once_with([], SAMPLE_FORECAST.points, SAMPLE_FORECAST.model, SAMPLE_FORECAST.model_params)


@patch("app.insert_forecast_snapshot")
@patch("app.get_forecast_cache", return_value=None)
def test_snapshot_daily_action_is_a_quiet_noop_before_first_precompute(mock_cache, mock_insert, client):
    response = post(client, {"secret": TEST_SECRET, "action": "snapshot_daily"})
    assert response.status_code == 200
    mock_insert.assert_not_called()
