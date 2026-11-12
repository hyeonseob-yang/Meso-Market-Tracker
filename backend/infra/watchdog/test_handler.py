import json
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

# handler.py reads these at import time (os.environ[...], no default) - set
# before importing it.
os.environ.setdefault("TRACKER_API_URL", "https://example.com/price")
os.environ.setdefault("DISCORD_WEBHOOK_URL", "https://discord.com/api/webhooks/test")
os.environ.setdefault("ALERT_SUBSCRIPTIONS_URL", "https://example.com/internal/alert-subscriptions")
os.environ.setdefault("WATCHDOG_SECRET", "test-watchdog-secret")

import handler  # noqa: E402


def _rows(*ages_minutes):
    """Newest-first rows (matching the real latestPrices(limit: 2) query),
    one per given age in minutes. average is a fixed placeholder - these
    tests are about staleness, not breakpoints (see _run_breakpoints)."""
    now = datetime.now(timezone.utc)
    return [{"datetime": (now - timedelta(minutes=m)).isoformat(), "average": 400} for m in ages_minutes]


def _forecast(age_minutes):
    """A forecast { updatedAt } value aged by the given number of minutes,
    or None to simulate a never-populated cache."""
    if age_minutes is None:
        return None
    now = datetime.now(timezone.utc)
    return {"updatedAt": (now - timedelta(minutes=age_minutes)).isoformat()}


def _snapshots(age_minutes):
    """A forecastSnapshots(limit: 1) result aged by the given number of
    minutes, or None to simulate no snapshot ever archived."""
    if age_minutes is None:
        return []
    now = datetime.now(timezone.utc)
    return [{"createdAt": (now - timedelta(minutes=age_minutes)).isoformat()}]


def _run(rows_or_none, forecast_age_minutes=30, snapshot_age_minutes=60, checks="prices", response=None):
    """Mocks _post: the GraphQL call returns the given rows and forecast/
    snapshot staleness (None rows simulates an unreachable API); returns
    whatever text got sent to Discord. checks picks which of the two
    EventBridge-scheduled invocations to simulate - "prices" (the default,
    matching most of this file's tests) or "health"."""
    notifications = []

    def fake_post(url, body):
        if url == handler.API_URL:
            if response is not None:
                return json.dumps(response).encode()
            if rows_or_none is None:
                raise OSError("connection refused")
            return json.dumps(
                {
                    "data": {
                        "latestPrices": rows_or_none,
                        "forecast": _forecast(forecast_age_minutes),
                        "forecastSnapshots": _snapshots(snapshot_age_minutes),
                    }
                }
            ).encode()
        notifications.append(json.loads(body)["content"])
        return b"{}"

    # No subscriptions by default - this file's existing tests are about the
    # staleness checks, not breakpoint alerts (see _run_breakpoints for those).
    with patch("handler._post", side_effect=fake_post), patch("handler._get", return_value=b"[]"):
        handler.handler({"checks": checks}, None)

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


_DB_ERROR = [{"message": "Unable to fetch forecast snapshots right now."}]


def test_null_data_with_errors_notifies_for_every_check():
    for checks in ("prices", "health", "snapshot"):
        notifications = _run(None, checks=checks, response={"data": None, "errors": _DB_ERROR})
        assert len(notifications) == 1
        assert "Tracker API returned an error" in notifications[0]
        assert "Unable to fetch forecast snapshots" in notifications[0]


def test_partial_errors_notify_instead_of_reporting_missing_forecast():
    response = {
        "data": {"latestPrices": _rows(30, 90), "forecast": None, "forecastSnapshots": _snapshots(30)},
        "errors": [{"message": "Unable to fetch the precomputed forecast right now."}],
    }
    notifications = _run(None, checks="health", response=response)
    assert len(notifications) == 1
    assert "Tracker API returned an error" in notifications[0]


def test_null_data_without_errors_notifies():
    notifications = _run(None, response={"data": None})
    assert len(notifications) == 1
    assert "Tracker API returned an error" in notifications[0]


def test_healthy_forecast_sends_no_notification():
    assert _run(_rows(30, 90), forecast_age_minutes=20, checks="health") == []


def test_stale_forecast_after_one_missed_run_notifies_once():
    notifications = _run(_rows(30, 90), forecast_age_minutes=80, checks="health")
    assert len(notifications) == 1
    assert "forecast cache hasn't refreshed" in notifications[0]


def test_stale_forecast_outside_bands_does_not_renotify():
    # ~140 is the next hourly check after the first alert.
    assert _run(_rows(30, 90), forecast_age_minutes=140, checks="health") == []


def test_still_stale_forecast_after_six_missed_runs_notifies_again():
    notifications = _run(_rows(30, 90), forecast_age_minutes=380, checks="health")
    assert len(notifications) == 1
    assert "still stale" in notifications[0]


def test_missing_forecast_notifies():
    notifications = _run(_rows(30, 90), forecast_age_minutes=None, checks="health")
    assert len(notifications) == 1
    assert "no forecast has been computed yet" in notifications[0]


def test_healthy_snapshot_sends_no_notification():
    # ~30 min is the expected age every time now - checked once daily, 30
    # min after the archive job itself.
    assert _run(_rows(30, 90), snapshot_age_minutes=30, checks="snapshot") == []


def test_snapshot_just_under_one_day_late_does_not_notify():
    assert _run(_rows(30, 90), snapshot_age_minutes=1400, checks="snapshot") == []


def test_stale_snapshot_in_first_band_notifies_once():
    notifications = _run(_rows(30, 90), snapshot_age_minutes=1470, checks="snapshot")
    assert len(notifications) == 1
    assert "no forecast snapshot archived in" in notifications[0]


def test_stale_snapshot_outside_bands_does_not_renotify():
    assert _run(_rows(30, 90), snapshot_age_minutes=1800, checks="snapshot") == []


def test_still_stale_snapshot_after_two_days_notifies_again():
    notifications = _run(_rows(30, 90), snapshot_age_minutes=2910, checks="snapshot")
    assert len(notifications) == 1
    assert "still no forecast snapshot archived" in notifications[0]


def test_missing_snapshot_notifies():
    notifications = _run(_rows(30, 90), snapshot_age_minutes=None, checks="snapshot")
    assert len(notifications) == 1
    assert "no forecast snapshot has ever been archived" in notifications[0]


def _price_rows(*averages):
    """Newest-first latestPrices(limit: 2)-shaped rows, average only -
    only the newest row is used by _check_breakpoints (it's level-triggered,
    not edge-triggered)."""
    return [{"average": a} for a in averages]


def _sub(id=1, webhook_url="https://discord.com/api/webhooks/1/a", name="Test", high=None, low=None, last_alerted_minutes_ago=None):
    """A subscription dict shaped like get_alert_subscriptions()'s output.
    last_alerted_minutes_ago=None means never alerted (the usual case for a
    freshly created subscription)."""
    last_alerted_at = None
    if last_alerted_minutes_ago is not None:
        last_alerted_at = (datetime.now(timezone.utc) - timedelta(minutes=last_alerted_minutes_ago)).isoformat()
    return {"id": id, "webhook_url": webhook_url, "name": name, "high": high, "low": low, "last_alerted_at": last_alerted_at}


def _run_breakpoints(rows, subscriptions):
    notifications = []  # list of (webhook_url, text)
    notified_calls = []  # list of (subscription_id, notified bool)

    def fake_post(url, body, headers=None):
        if url.startswith(handler.ALERT_SUBSCRIPTIONS_URL):
            subscription_id = int(url.rsplit("/", 2)[-2])
            notified_calls.append((subscription_id, json.loads(body)["notified"]))
        else:
            notifications.append((url, json.loads(body)["content"]))
        return b"{}"

    with patch("handler._post", side_effect=fake_post):
        handler._check_breakpoints({"latestPrices": rows}, subscriptions)

    return notifications, notified_calls


def test_no_subscriptions_sends_no_notification():
    notifications, notified_calls = _run_breakpoints(_price_rows(600), [])
    assert notifications == []
    assert notified_calls == []


def test_newly_crossed_high_notifies_and_records_it():
    sub = _sub(high=500)
    notifications, notified_calls = _run_breakpoints(_price_rows(600), [sub])
    assert len(notifications) == 1
    assert notifications[0][0] == sub["webhook_url"]
    assert "crossed above" in notifications[0][1]
    assert notified_calls == [(sub["id"], True)]


def test_already_crossed_before_subscription_existed_still_notifies():
    # Never alerted before (last_alerted_at is None) even though the price
    # has presumably been past the threshold for a while - this is the bug
    # that motivated level-triggering: a subscription created while already
    # crossed must not wait for a fresh edge to alert.
    sub = _sub(low=410)
    notifications, notified_calls = _run_breakpoints(_price_rows(392), [sub])
    assert len(notifications) == 1
    assert "crossed below" in notifications[0][1]
    assert notified_calls == [(sub["id"], True)]


def test_recently_notified_does_not_renotify_within_reminder_interval():
    sub = _sub(high=500, last_alerted_minutes_ago=60)
    notifications, notified_calls = _run_breakpoints(_price_rows(600), [sub])
    assert notifications == []
    assert notified_calls == []


def test_still_crossed_after_reminder_interval_notifies_again():
    sub = _sub(high=500, last_alerted_minutes_ago=handler.REMINDER_INTERVAL_MINUTES + 10)
    notifications, notified_calls = _run_breakpoints(_price_rows(600), [sub])
    assert len(notifications) == 1
    assert "is still above" in notifications[0][1]
    assert notified_calls == [(sub["id"], True)]


def test_crossing_below_low_notifies():
    sub = _sub(low=300)
    notifications, _ = _run_breakpoints(_price_rows(200), [sub])
    assert len(notifications) == 1
    assert "below" in notifications[0][1]


def test_no_longer_crossed_clears_recorded_state():
    sub = _sub(high=500, last_alerted_minutes_ago=60)
    notifications, notified_calls = _run_breakpoints(_price_rows(400), [sub])
    assert notifications == []
    assert notified_calls == [(sub["id"], False)]


def test_never_notified_and_not_crossed_has_no_side_effects():
    sub = _sub(high=500)
    notifications, notified_calls = _run_breakpoints(_price_rows(400), [sub])
    assert notifications == []
    assert notified_calls == []


def test_only_the_crossing_subscription_is_notified():
    crossing = _sub(id=1, webhook_url="https://discord.com/api/webhooks/1/a", name="Crossing", high=500)
    not_crossing = _sub(id=2, webhook_url="https://discord.com/api/webhooks/2/b", name="Not crossing", high=1000)
    notifications, notified_calls = _run_breakpoints(_price_rows(600), [crossing, not_crossing])
    assert len(notifications) == 1
    assert notifications[0][0] == crossing["webhook_url"]
    assert notified_calls == [(crossing["id"], True)]


def test_null_average_does_not_crash_or_notify():
    sub = _sub(high=500)
    notifications, notified_calls = _run_breakpoints([{"average": None}], [sub])
    assert notifications == []
    assert notified_calls == []


def test_two_different_users_sharing_one_webhook_evaluated_independently():
    shared_url = "https://discord.com/api/webhooks/1/a"
    high_sub = _sub(id=1, webhook_url=shared_url, name="User A's high alert", high=500)
    low_sub = _sub(id=2, webhook_url=shared_url, name="User B's low alert", low=300)
    # Crosses high (600 > 500) but not low (600 is not < 300) - only the high one should fire.
    notifications, notified_calls = _run_breakpoints(_price_rows(600), [high_sub, low_sub])
    assert len(notifications) == 1
    assert "User A's high alert" in notifications[0][1]
    assert notified_calls == [(high_sub["id"], True)]
