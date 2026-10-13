from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from forecasting import MIN_DATA_POINTS_FOR_AUTOETS, compute_forecast, resample_hourly
from models import PriceRecord


def _hourly_records(n_hours: int, value_fn=lambda i: 1000.0, start=None) -> list[PriceRecord]:
    start = start or datetime(2026, 1, 1, tzinfo=timezone.utc)
    return [
        PriceRecord(
            id=i,
            datetime=(start + timedelta(hours=i)).isoformat(),
            average=value_fn(i),
            buy100M=1,
            buy1B=1,
            buy10B=1,
            sell100M=1,
            sell1B=1,
            sell10B=1,
            notes="",
        )
        for i in range(n_hours)
    ]


def test_resample_hourly_requires_at_least_two_records():
    with pytest.raises(ValueError):
        resample_hourly(_hourly_records(1))


def test_resample_hourly_forward_fills_a_mid_series_gap():
    records = _hourly_records(10)
    # Drop hours 4 and 5, leaving a gap - timestamps 0,1,2,3,6,7,8,9.
    sparse = [r for r in records if r.id not in (4, 5)]

    series = resample_hourly(sparse)

    assert len(series) == 10  # no gaps in the resulting hourly index
    assert series.iloc[4] == series.iloc[3]  # forward-filled from the last real value
    assert series.iloc[5] == series.iloc[3]


@patch("forecasting.AutoETS", side_effect=RuntimeError("mocked - horizon math doesn't depend on which model fits"))
@patch("forecasting.get_forecast_training_prices")
def test_compute_forecast_horizon_derived_from_training_span(mock_get, mock_autoets):
    # Exactly 40 days of hourly records -> training_span_days = 39 (last-first)
    # -> horizon_days = max(1, 39 // 2) = 19 -> 19*24 points. Computed before
    # model fitting, so forcing the (fast) Naive fallback here doesn't affect
    # this - real AutoETS timing is covered by manual smoke-testing instead,
    # since a real fit at this data size is tens of seconds with sp=168.
    mock_get.return_value = _hourly_records(40 * 24, value_fn=lambda i: 1000.0 + i * 0.01)

    forecast = compute_forecast()

    assert len(forecast.points) == 19 * 24


@patch("forecasting.get_forecast_training_prices")
def test_compute_forecast_short_span_still_produces_at_least_one_day(mock_get):
    mock_get.return_value = _hourly_records(2 * 24, value_fn=lambda i: 1000.0 + i * 0.01)

    forecast = compute_forecast()

    assert len(forecast.points) >= 24


@patch("forecasting.AutoETS", side_effect=RuntimeError("mocked - output shape is model-agnostic, see below"))
@patch("forecasting.get_forecast_training_prices")
def test_compute_forecast_points_are_structurally_valid(mock_get, mock_autoets):
    # AutoETS forced to fail so this exercises the (fast) Naive path - the
    # output-assembly code being tested here (point ordering/bounds) runs
    # identically regardless of which model produced predict()/
    # predict_interval(), so this still covers it without the real fit's
    # cost (tens of seconds at the sp=168 minimum data size).
    mock_get.return_value = _hourly_records(
        MIN_DATA_POINTS_FOR_AUTOETS + 24, value_fn=lambda i: 1000.0 + i * 0.05
    )

    forecast = compute_forecast()

    timestamps = [p["datetime"] for p in forecast.points]
    assert timestamps == sorted(timestamps)
    assert len(set(timestamps)) == len(timestamps)
    for p in forecast.points:
        assert p["lower"] <= p["predicted"] + 1e-6
        assert p["predicted"] <= p["upper"] + 1e-6


@patch("forecasting.get_forecast_training_prices")
def test_compute_forecast_falls_back_to_naive_below_min_points(mock_get):
    mock_get.return_value = _hourly_records(MIN_DATA_POINTS_FOR_AUTOETS - 1)

    forecast = compute_forecast()

    assert forecast.model == "NaiveForecaster"


@patch("forecasting.AutoETS", side_effect=RuntimeError("mocked - see comment below"))
@patch("forecasting.get_forecast_training_prices")
def test_compute_forecast_falls_back_cleanly_on_degenerate_series(mock_get, mock_autoets):
    # An entirely flat series at/above the AutoETS threshold was confirmed
    # empirically to crash AutoETS.fit() outright (zero variance, no
    # converged model has finite aic) - and to still take ~40s to fail even
    # at sp=168's 2-cycle minimum, since auto=True tries several candidates
    # before giving up. Mocking the exception directly tests the same
    # fallback path (any AutoETS failure -> NaiveForecaster) without paying
    # that cost on every test run.
    mock_get.return_value = _hourly_records(MIN_DATA_POINTS_FOR_AUTOETS + 24, value_fn=lambda i: 1000.0)

    forecast = compute_forecast()

    assert forecast.model == "NaiveForecaster"
    assert len(forecast.points) > 0


@patch("forecasting.get_forecast_training_prices")
def test_compute_forecast_raises_when_not_enough_history(mock_get):
    mock_get.return_value = _hourly_records(1)

    with pytest.raises(RuntimeError, match="Not enough price history"):
        compute_forecast()


@patch("forecasting.get_forecast_training_prices", return_value=[])
def test_compute_forecast_raises_on_empty_history(mock_get):
    with pytest.raises(RuntimeError, match="Not enough price history"):
        compute_forecast()
