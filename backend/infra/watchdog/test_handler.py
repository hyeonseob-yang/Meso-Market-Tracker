import json
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

# handler.py reads these at import time (os.environ[...], no default) - set
# before importing it.
os.environ.setdefault("TRACKER_API_URL", "https://example.com/price")
os.environ.setdefault("DISCORD_WEBHOOK_URL", "https://discord.com/api/webhooks/test")

import handler  # noqa: E402


def _rows(*ages_minutes):
    """Newest-first rows (matching the real latestPrices(limit: 2) query),
    one per given age in minutes."""
    now = datetime.now(timezone.utc)
    return [{"datetime": (now - timedelta(minutes=m)).isoformat()} for m in ages_minutes]


def _run(rows_or_none):
    """Mocks _post: the GraphQL call returns the given rows (None simulates
    an unreachable API); returns whatever text got sent to Discord."""
    notifications = []

    def fake_post(url, body):
        if url == handler.API_URL:
            if rows_or_none is None:
                raise OSError("connection refused")
            return json.dumps({"data": {"latestPrices": rows_or_none}}).encode()
        notifications.append(json.loads(body)["content"])
        return b"{}"

    with patch("handler._post", side_effect=fake_post):
        handler.handler({}, None)

    return notifications


def test_healthy_data_sends_no_notification():
    assert _run(_rows(30, 90)) == []


def test_stale_in_first_band_notifies_once():
    notifications = _run(_rows(100))
    assert len(notifications) == 1
    assert "no new row for" in notifications[0]


def test_stale_outside_bands_does_not_renotify():
    # Already alerted once at the 90-150 min band - don't spam every
    # hourly check while it stays stale in between.
    assert _run(_rows(200)) == []


def test_still_stale_after_six_hours_notifies_again():
    notifications = _run(_rows(400))
    assert len(notifications) == 1
    assert "still no new row" in notifications[0]


def test_resumed_after_a_real_gap_notifies():
    notifications = _run(_rows(10, 120))
    assert len(notifications) == 1
    assert "resumed" in notifications[0]


def test_normal_hourly_cadence_does_not_notify():
    assert _run(_rows(10, 45)) == []


def test_no_rows_notifies():
    notifications = _run([])
    assert len(notifications) == 1
    assert "no rows" in notifications[0]


def test_unreachable_api_notifies():
    notifications = _run(None)
    assert len(notifications) == 1
    assert "couldn't reach" in notifications[0]
