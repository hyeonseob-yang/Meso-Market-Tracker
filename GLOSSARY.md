# Meso Market Tracker

Tracks the price of meso (MapleStory's in-game currency) in Maple Points over time, forecasts where it is heading, and alerts users when it crosses their thresholds.

## Market

**Meso**:
MapleStory's in-game currency; the thing whose price is tracked.

**Maple Points**:
MapleStory's premium currency; the unit every price in the Tracker is expressed in.
_Avoid_: NX, points

**Price Reading**:
One hourly observation of the meso market.
_Avoid_: row, record, data point

**Average**:
The mean traded price, in Maple Points, over the rolling 100B-meso trade window at the time of a Price Reading. Absent when the window had no completed trades.
_Avoid_: price (on its own), mean

**Manual Reading**:
A Price Reading entered by hand rather than posted by the Collector, mostly history from before automated collection began. Shown on the chart but never used to train a Forecast.
_Avoid_: backfill, test entry

## Systems

**Tracker**:
This app as a whole: it stores Price Readings, produces Forecasts, and sends alerts.
_Avoid_: backend, API (when meaning the whole product)

**Collector**:
The separate program that observes the in-game market and posts one Price Reading to the Tracker each hour; the only source of non-manual readings.
_Avoid_: scraper, feed, bot

## Forecasting

**Forecast**:
The model's current projection of the Average over the coming hours, with confidence bands; refreshed hourly.
_Avoid_: prediction, projection

**Forecast Snapshot**:
A frozen copy of the Forecast as it stood at one moment, kept so it can later be compared against the Price Readings that actually arrived.
_Avoid_: saved prediction, backup

**Archived Snapshot**:
A Forecast Snapshot taken automatically once a day; it has no owner.
_Avoid_: daily backup

**Saved Snapshot**:
A Forecast Snapshot taken manually by a logged-in user; visible only to that user.

## Alerts

**Price Alert**:
A user's request to be notified on their own Discord webhook when the Average goes beyond a High or Low Threshold.
_Avoid_: alert subscription, breakpoint, trigger

**Threshold**:
The High or Low Average value a Price Alert watches; either may be left unset, but not both.

**Triggered**:
The state of a Price Alert while the latest Average is beyond one of its Thresholds — a state, not a moment of crossing.
_Avoid_: crossed (as a state)

**Reminder**:
A repeat notification sent once a day while a Price Alert stays Triggered.

**Cleared**:
The state of a Price Alert once the Average is back within its Thresholds; the next time it becomes Triggered notifies immediately.

**Health Alert**:
A message to the site owner when the Tracker or Collector appears broken: no new Price Readings, a stale Forecast, a missing Archived Snapshot, or the Tracker failing to respond.
_Avoid_: watchdog alert, staleness alert
