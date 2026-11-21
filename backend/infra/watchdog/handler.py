"""Health Alerts for the Tracker (stale Price Readings, Forecast, Archived
Snapshot; repeated until resolved) plus users' Price Alerts. Stdlib only -
deployed as a plain zip rather than a container image."""

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone

API_URL = os.environ["TRACKER_API_URL"]
WEBHOOK_URL = os.environ["DISCORD_WEBHOOK_URL"]
ALERT_SUBSCRIPTIONS_URL = os.environ["ALERT_SUBSCRIPTIONS_URL"]
WATCHDOG_SECRET = os.environ["WATCHDOG_SECRET"]
HEARTBEAT_URL = os.environ["HEARTBEAT_URL"]

SECONDS_PER_MINUTE = 60
MINUTES_PER_HOUR = 60
HOURS_PER_DAY = 24
HTTP_TIMEOUT_SECONDS = 20

REMINDER_INTERVAL_MINUTES = HOURS_PER_DAY * MINUTES_PER_HOUR
STALE_REPEAT_MINUTES = 6 * MINUTES_PER_HOUR
HOURLY_CHECK_MINUTES = MINUTES_PER_HOUR
STALE_AFTER_MINUTES = 60
STALE_FIRST_ALERT_UNTIL_MINUTES = 120
SNAPSHOT_STALE_AFTER_MINUTES = 1410
SNAPSHOT_FIRST_ALERT_UNTIL_MINUTES = 1530
MISSED_READING_GAP_MINUTES = 90
SHOW_DAYS_AFTER_HOURS = 48

QUERY = (
    '{"query": "{ latestPrices(limit: 2) { datetime average } forecast { updatedAt } '
    'forecastSnapshots(limit: 1) { createdAt } }"}'
)


def _post(url: str, body: str, headers: dict | None = None) -> bytes:
    request = urllib.request.Request(
        url,
        data=body.encode(),
        headers={"Content-Type": "application/json", "User-Agent": "meso-market-watchdog", **(headers or {})},
    )
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
        return response.read()


def _get(url: str, headers: dict) -> bytes:
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
        return response.read()


def _notify(text: str) -> None:
    _post(WEBHOOK_URL, json.dumps({"content": text}))


def _notify_webhook(url: str, text: str) -> None:
    _post(url, json.dumps({"content": text}))


def _duration(minutes: float) -> str:
    hours = minutes / MINUTES_PER_HOUR
    return f"{hours:.0f} hours" if hours < SHOW_DAYS_AFTER_HOURS else f"{hours / HOURS_PER_DAY:.1f} days"


def _stale_alert_due(age: float) -> bool:
    """For hourly checks: true at the first check STALE_AFTER_MINUTES stale, then
    once every STALE_REPEAT_MINUTES. Each window is HOURLY_CHECK_MINUTES wide,
    so exactly one hourly check falls in it and no state is needed."""
    return age >= STALE_AFTER_MINUTES and (age - STALE_AFTER_MINUTES) % STALE_REPEAT_MINUTES < HOURLY_CHECK_MINUTES


def _check_prices(data: dict) -> None:
    rows = data["latestPrices"]

    if not rows:
        _notify("Meso Market: Tracker returned no rows - is the database paused?")
        return

    latest = datetime.fromisoformat(rows[0]["datetime"])
    age = (datetime.now(timezone.utc) - latest).total_seconds() / SECONDS_PER_MINUTE

    gap = None
    if len(rows) > 1:
        second_latest = datetime.fromisoformat(rows[1]["datetime"])
        gap = (latest - second_latest).total_seconds() / SECONDS_PER_MINUTE

    if _stale_alert_due(age):
        if age < STALE_FIRST_ALERT_UNTIL_MINUTES:
            _notify(f"Meso Market: no new row for {age:.0f} min (last at {latest:%H:%M} UTC).")
        else:
            _notify(
                f"Meso Market: still no new row after {_duration(age)} (last at {latest:%Y-%m-%d %H:%M} UTC)."
            )
    elif age < STALE_AFTER_MINUTES and gap is not None and gap >= MISSED_READING_GAP_MINUTES:
        _notify(f"Meso Market: collection resumed after a {_duration(gap)} gap.")


def _check_forecast(data: dict) -> None:
    forecast = data.get("forecast")

    if forecast is None:
        # Notifies unconditionally, same as the no-rows case above - fine
        # briefly after a fresh deploy, wrong if it stays this way.
        _notify("Meso Market: no forecast has been computed yet.")
        return

    updated_at = datetime.fromisoformat(forecast["updatedAt"])
    age = (datetime.now(timezone.utc) - updated_at).total_seconds() / SECONDS_PER_MINUTE

    if _stale_alert_due(age):
        if age < STALE_FIRST_ALERT_UNTIL_MINUTES:
            _notify(f"Meso Market: forecast cache hasn't refreshed in {age:.0f} min.")
        else:
            _notify(f"Meso Market: forecast cache still stale after {_duration(age)}.")


def _check_snapshot(data: dict) -> None:
    snapshots = data["forecastSnapshots"]

    if not snapshots:
        _notify("Meso Market: no forecast snapshot has ever been archived.")
        return

    created_at = datetime.fromisoformat(snapshots[0]["createdAt"])
    age = (datetime.now(timezone.utc) - created_at).total_seconds() / SECONDS_PER_MINUTE

    # Checked once a day, so every check alerts for as long as one is missing.
    if age >= SNAPSHOT_STALE_AFTER_MINUTES:
        if age < SNAPSHOT_FIRST_ALERT_UNTIL_MINUTES:
            _notify(f"Meso Market: no forecast snapshot archived in {age / MINUTES_PER_HOUR:.0f} hours.")
        else:
            _notify(f"Meso Market: still no forecast snapshot archived after {_duration(age)}.")


def _set_notified(subscription_id: int, notified: bool) -> None:
    _post(
        f"{ALERT_SUBSCRIPTIONS_URL}/{subscription_id}/notified",
        json.dumps({"notified": notified}),
        {"x-watchdog-secret": WATCHDOG_SECRET},
    )


def _check_breakpoints(data: dict, subscriptions: list[dict]) -> None:
    rows = data["latestPrices"]
    if not rows or rows[0]["average"] is None:
        return

    latest = rows[0]["average"]
    now = datetime.now(timezone.utc)

    # Level-triggered, not edge-triggered: alerts as soon as a subscription
    # is found crossed, even if it was already crossed before the
    # subscription existed or before the watchdog last ran. Suppressed for
    # REMINDER_INTERVAL_MINUTES after each alert so a sustained crossing
    # doesn't spam every hourly check, then repeated as a reminder. Cleared
    # once the price returns to the healthy side, so the next crossing
    # alerts immediately rather than waiting out a stale interval.
    for sub in subscriptions:
        high, low = sub["high"], sub["low"]
        crossed_high = high is not None and latest > high
        crossed_low = low is not None and latest < low
        last_alerted_at = sub["last_alerted_at"]

        if not (crossed_high or crossed_low):
            if last_alerted_at is not None:
                _set_notified(sub["id"], False)
            continue

        first_time = last_alerted_at is None
        if not first_time:
            age = (now - datetime.fromisoformat(last_alerted_at)).total_seconds() / SECONDS_PER_MINUTE
            if age < REMINDER_INTERVAL_MINUTES:
                continue

        if crossed_high:
            verb, threshold = ("is above" if first_time else "is still above"), high
        else:
            verb, threshold = ("is below" if first_time else "is still below"), low

        _notify_webhook(
            sub["webhook_url"], f"Meso Market alert '{sub['name']}': average {verb} {threshold} (now {latest})."
        )
        _set_notified(sub["id"], True)


def _ping_heartbeat() -> None:
    # A failed ping must not fail the run: Lambda would retry it and repeat its alerts.
    try:
        _post(HEARTBEAT_URL, "")
    except (urllib.error.URLError, OSError) as error:
        print(f"Heartbeat ping failed: {error}")


def handler(event, context):
    """Three separate EventBridge rules invoke this with a different
    `checks` value: "prices" at :10 (time-sensitive - Price Alerts should
    fire soon after the Average moves), "health" at :30 (forecast
    staleness, checked after precompute's own :10 run), "snapshot" once
    daily at 01:00 (30 min after the daily archive job itself).

    Pings the external heartbeat only when the run completes; the heartbeat
    service alerts if the pings stop."""
    _run_checks(event)
    _ping_heartbeat()


def _run_checks(event) -> None:
    try:
        body = json.loads(_post(API_URL, QUERY))
    except (urllib.error.URLError, OSError, ValueError) as error:
        _notify(f"Meso Market: watchdog couldn't reach the Tracker API: {error}")
        return

    # A failing non-null field (latestPrices, forecastSnapshots) nulls all of
    # `data`; a failing nullable one (forecast) reads as null. Both still
    # return HTTP 200 with `errors`.
    data = body.get("data") if isinstance(body, dict) else None
    errors = body.get("errors") if isinstance(body, dict) else None
    if errors or data is None:
        detail = errors[0].get("message", errors[0]) if errors else "no data"
        _notify(f"Meso Market: Tracker API returned an error - is the database down? ({detail})")
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
    elif event.get("checks") == "snapshot":
        _check_snapshot(data)
