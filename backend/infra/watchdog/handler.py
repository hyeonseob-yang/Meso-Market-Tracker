"""Hourly staleness check for the price Tracker, plus per-user price
breakpoint alerts. Posts to a Discord webhook if the newest row is too old,
again after a longer delay if it's still stale, and once when collection
resumes after a real gap. Stdlib only - no dependencies to package, deployed
as a plain zip rather than a container image."""

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone

API_URL = os.environ["TRACKER_API_URL"]
WEBHOOK_URL = os.environ["DISCORD_WEBHOOK_URL"]
ALERT_SUBSCRIPTIONS_URL = os.environ["ALERT_SUBSCRIPTIONS_URL"]
WATCHDOG_SECRET = os.environ["WATCHDOG_SECRET"]
QUERY = (
    '{"query": "{ latestPrices(limit: 2) { datetime average } forecast { updatedAt } '
    'forecastSnapshots(limit: 1) { createdAt } }"}'
)


def _post(url: str, body: str) -> bytes:
    request = urllib.request.Request(
        url,
        data=body.encode(),
        headers={"Content-Type": "application/json", "User-Agent": "meso-market-watchdog"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read()


def _get(url: str, headers: dict) -> bytes:
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read()


def _notify(text: str) -> None:
    _post(WEBHOOK_URL, json.dumps({"content": text}))


def _notify_webhook(url: str, text: str) -> None:
    _post(url, json.dumps({"content": text}))


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

    # Runs hourly at :10, shortly after the Collector's ~:01 post, so a
    # healthy newest row is only about 10 minutes old at check time. These
    # bands avoid re-alerting on every single check while something stays stale.
    if 90 <= age < 150:
        _notify(f"Meso Market: no new row for {age:.0f} min (last at {latest:%H:%M} UTC).")
    elif 390 <= age < 450:
        _notify(f"Meso Market: still no new row after {age / 60:.0f} hours.")
    elif age < 60 and gap is not None and gap >= 90:
        _notify(f"Meso Market: collection resumed after a {gap / 60:.1f} hour gap.")


def _check_forecast(data: dict) -> None:
    forecast = data.get("forecast")

    if forecast is None:
        # Notifies unconditionally, same as the no-rows case above - fine
        # briefly after a fresh deploy, wrong if it stays this way.
        _notify("Meso Market: no forecast has been computed yet.")
        return

    updated_at = datetime.fromisoformat(forecast["updatedAt"])
    age = (datetime.now(timezone.utc) - updated_at).total_seconds() / 60

    # Precompute runs hourly at :10, this check at :30. Same 90/390 min
    # bands as the price check, for the same reason: each is itself an
    # hourly job, so these thresholds mean "one missed cycle" / "several."
    if 90 <= age < 150:
        _notify(f"Meso Market: forecast cache hasn't refreshed in {age:.0f} min.")
    elif 390 <= age < 450:
        _notify(f"Meso Market: forecast cache still stale after {age / 60:.0f} hours.")


def _check_snapshot(data: dict) -> None:
    snapshots = data["forecastSnapshots"]

    if not snapshots:
        _notify("Meso Market: no forecast snapshot has ever been archived.")
        return

    created_at = datetime.fromisoformat(snapshots[0]["createdAt"])
    age = (datetime.now(timezone.utc) - created_at).total_seconds() / 60

    # The daily archive runs once at 00:05 UTC, so a healthy snapshot can be
    # anywhere from minutes to just under 24.5 hours old depending on when
    # this hourly check happens to run - bands start well past that ceiling.
    if 1500 <= age < 1560:
        _notify(f"Meso Market: no forecast snapshot archived in {age / 60:.0f} hours.")
    elif 2940 <= age < 3000:
        _notify(f"Meso Market: still no forecast snapshot archived after {age / 60:.0f} hours.")


def _check_breakpoints(data: dict, subscriptions: list[dict]) -> None:
    rows = data["latestPrices"]
    if not rows or rows[0]["average"] is None:
        return

    latest = rows[0]["average"]
    previous = rows[1]["average"] if len(rows) > 1 else None

    for sub in subscriptions:
        high, low = sub["high"], sub["low"]
        if high is not None and latest > high and not (previous is not None and previous > high):
            _notify_webhook(
                sub["webhook_url"], f"Meso Market alert '{sub['name']}': average crossed above {high} (now {latest})."
            )
        if low is not None and latest < low and not (previous is not None and previous < low):
            _notify_webhook(
                sub["webhook_url"], f"Meso Market alert '{sub['name']}': average crossed below {low} (now {latest})."
            )


def handler(event, context):
    """Two separate EventBridge rules invoke this with a different `checks`
    value: "prices" at :10 (time-sensitive - breakpoint alerts should fire
    soon after a crossing), "health" at :30 (forecast/snapshot staleness,
    not time-sensitive, checked after their own :10 precompute has run)."""
    try:
        data = json.loads(_post(API_URL, QUERY))["data"]
    except (urllib.error.URLError, OSError, KeyError, ValueError) as error:
        _notify(f"Meso Market: watchdog couldn't reach the Tracker API: {error}")
        return

    if event.get("checks") == "prices":
        _check_prices(data)
        try:
            subscriptions = json.loads(_get(ALERT_SUBSCRIPTIONS_URL, {"x-watchdog-secret": WATCHDOG_SECRET}))
        except (urllib.error.URLError, OSError, ValueError) as error:
            _notify(f"Meso Market: watchdog couldn't reach the alert-subscriptions endpoint: {error}")
            return
        _check_breakpoints(data, subscriptions)
    elif event.get("checks") == "health":
        _check_forecast(data)
        _check_snapshot(data)
