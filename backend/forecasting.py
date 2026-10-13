import logging
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
from sktime.forecasting.ets import AutoETS
from sktime.forecasting.naive import NaiveForecaster

from config import MAX_TRAINING_DAYS
from database import get_forecast_training_prices
from models import Forecast, PriceRecord

logger = logging.getLogger(__name__)

MIN_DATA_POINTS_FOR_AUTOETS = 48
_CONFIDENCE_COVERAGE = 0.9


def resample_hourly(records: list[PriceRecord]) -> pd.Series:
    if len(records) < 2:
        raise ValueError("Need at least 2 records to resample.")

    series = pd.Series(
        [float(r.average) for r in records],
        index=pd.to_datetime([r.datetime for r in records], utc=True),
    ).sort_index()
    hourly = series.resample("1h").mean().ffill()
    hourly.index = hourly.index.tz_localize(None)
    return hourly


def _fit_model(series: pd.Series) -> tuple[str, dict, object]:
    if len(series) >= MIN_DATA_POINTS_FOR_AUTOETS:
        try:
            model = AutoETS(auto=True, sp=24, n_jobs=1)
            model.fit(series)
            return "AutoETS", {"auto": True, "sp": 24}, model
        except Exception as error:
            logger.warning("AutoETS fit failed, falling back to NaiveForecaster: %s", error)

    model = NaiveForecaster(strategy="drift")
    model.fit(series)
    return "NaiveForecaster", {"strategy": "drift"}, model


def _predict_interval(
    model, fh: np.ndarray, series: pd.Series, point_forecast: pd.Series
) -> tuple[np.ndarray, np.ndarray]:
    try:
        interval = model.predict_interval(fh=fh, coverage=_CONFIDENCE_COVERAGE)
        lower = interval.xs("lower", axis=1, level=-1).iloc[:, 0].to_numpy()
        upper = interval.xs("upper", axis=1, level=-1).iloc[:, 0].to_numpy()
        return lower, upper
    except Exception as error:
        logger.warning("predict_interval failed, synthesizing a fallback band: %s", error)
        resid_std = series.diff().dropna().std() or abs(series.iloc[-1]) * 0.01 or 1.0
        spread = resid_std * np.sqrt(np.arange(1, len(fh) + 1)) * 1.64
        predicted = point_forecast.to_numpy()
        return predicted - spread, predicted + spread


def compute_forecast() -> Forecast:
    since = (datetime.now(timezone.utc) - timedelta(days=MAX_TRAINING_DAYS)).isoformat()
    records = get_forecast_training_prices(since=since)

    if len(records) < 2:
        raise RuntimeError("Not enough price history to generate a forecast.")

    series = resample_hourly(records)

    training_span_days = (series.index[-1] - series.index[0]).total_seconds() / 86400
    horizon_days = max(1, int(training_span_days // 2))
    fh = np.arange(1, horizon_days * 24 + 1)

    model_name, model_params, model = _fit_model(series)
    point_forecast = model.predict(fh=fh)
    lower, upper = _predict_interval(model, fh, series, point_forecast)

    timestamps = point_forecast.index
    predicted_values = point_forecast.to_numpy()
    points = [
        {
            "datetime": pd.Timestamp(ts).isoformat(),
            "predicted": float(p),
            "lower": float(lo),
            "upper": float(hi),
        }
        for ts, p, lo, hi in zip(timestamps, predicted_values, lower, upper)
    ]

    history = [{"datetime": r.datetime, "average": r.average} for r in records]

    return Forecast(model=model_name, model_params=model_params, points=points, history=history)
