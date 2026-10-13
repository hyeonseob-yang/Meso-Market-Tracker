"""Hourly staleness check for the price Tracker. Posts to a Discord webhook
if the newest row is too old, again after a longer delay if it's still
stale, and once when collection resumes after a real gap. Stdlib only - no
dependencies to package, deployed as a plain zip rather than a container
image.

Uses `latestPrices(limit: 2)` rather than paging through the full,
oldest-first `prices` query to find the tail end - cheap regardless of how
large the table gets.
"""

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone

API_URL = os.environ["TRACKER_API_URL"]
WEBHOOK_URL = os.environ["DISCORD_WEBHOOK_URL"]
QUERY = '{"query": "{ latestPrices(limit: 2) { datetime } forecast { updatedAt } }"}'


def _post(url: str, body: str) -> bytes:
    request = urllib.request.Request(
        url,
        data=body.encode(),
        headers={"Content-Type": "application/json", "User-Agent": "meso-market-watchdog"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read()


def _notify(text: str) -> None:
    _post(WEBHOOK_URL, json.dumps({"content": text}))


def _check_prices(data: dict) -> None:
    rows = data["latestPrices"]

    if not rows:
        _notify("Meso Market: Tracker returned no rows - is the database paused?")
        return

    latest = datetime.fromisoformat(rows[0]["datetime"])
    age = (datetime.now(timezone.utc) - latest).total_seconds() / 60

    gap = None
    if len(rows) > 1:
        second_latest = datetime.fromisoformat(rows[1]["datetime"])
        gap = (latest - second_latest).total_seconds() / 60

    # Runs hourly at :30. The Collector posts at about :01, so a healthy
    # newest row is about 30 minutes old at check time. These bands avoid
    # re-alerting on every single check while something stays stale.
    if 90 <= age < 150:
        _notify(f"Meso Market: no new row for {age:.0f} min (last at {latest:%H:%M} UTC).")
    elif 390 <= age < 450:
        _notify(f"Meso Market: still no new row after {age / 60:.0f} hours.")
    elif age < 60 and gap is not None and gap >= 90:
        _notify(f"Meso Market: collection resumed after a {gap / 60:.1f} hour gap.")


def _check_forecast(data: dict) -> None:
    forecast = data.get("forecast")

    if forecast is None:
        # Expected briefly right after a fresh deploy (before the first
        # hourly precompute run); genuinely wrong to stay this way for
        # long, which the 390+ band below would still catch once there
        # was ever a real forecast.updatedAt to go stale.
        _notify("Meso Market: no forecast has been computed yet.")
        return

    updated_at = datetime.fromisoformat(forecast["updatedAt"])
    age = (datetime.now(timezone.utc) - updated_at).total_seconds() / 60

    # Precompute runs hourly at :10, this check at :30 - same 90/390 min
    # bands as the price check, for the same reason (one missed cycle vs.
    # a sustained outage), since both run on the same hourly cadence.
    if 90 <= age < 150:
        _notify(f"Meso Market: forecast cache hasn't refreshed in {age:.0f} min.")
    elif 390 <= age < 450:
        _notify(f"Meso Market: forecast cache still stale after {age / 60:.0f} hours.")


def handler(event, context):
    try:
        data = json.loads(_post(API_URL, QUERY))["data"]
    except (urllib.error.URLError, OSError, KeyError, ValueError) as error:
        _notify(f"Meso Market: watchdog couldn't reach the Tracker API: {error}")
        return

    _check_prices(data)
    _check_forecast(data)
