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
QUERY = '{"query": "{ latestPrices(limit: 2) { datetime } }"}'


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


def handler(event, context):
    try:
        rows = json.loads(_post(API_URL, QUERY))["data"]["latestPrices"]
    except (urllib.error.URLError, OSError, KeyError, ValueError) as error:
        _notify(f"Meso Market: watchdog couldn't reach the Tracker API: {error}")
        return

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
