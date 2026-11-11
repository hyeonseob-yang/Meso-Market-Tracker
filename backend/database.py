import logging
import os
import re
import psycopg2
import psycopg2.errors
from psycopg2.extras import Json
from dotenv import load_dotenv

from models import AlertSubscription, Forecast, ForecastSnapshotRecord, PriceInput, PriceRecord

logger = logging.getLogger(__name__)

_CREDENTIAL_PATTERN = re.compile(r"(password|passwd|pwd)=[^\s;]+", re.IGNORECASE)


def _sanitize(msg: str) -> str:
    return _CREDENTIAL_PATTERN.sub(r"\1=***", msg)

load_dotenv()

_conn = None


def _get_conn():
    global _conn
    if _conn is None or _conn.closed:
        _conn = psycopg2.connect(**_get_config())
        return _conn
    try:
        _conn.cursor().execute("SELECT 1")
        return _conn
    except psycopg2.OperationalError:
        _conn = psycopg2.connect(**_get_config())
        return _conn


def _get_config():
    return {
        "host": os.environ["DB_HOST"],
        "port": os.environ.get("DB_PORT", "6543"),
        "dbname": os.environ["DB_NAME"],
        "user": os.environ["DB_USER"],
        "password": os.environ["DB_PASSWORD"],
        "sslmode": "require",
        "connect_timeout": 5,
    }


def insert_price(price: PriceInput, occurred_at: str):
    # ON CONFLICT DO UPDATE (a no-op column reassignment) rather than DO
    # NOTHING, so a retried insert still returns the existing row's id
    # instead of an empty result.
    sql = """INSERT INTO price(datetime, average, buy100M, buy1B, buy10B, sell100M, sell1B, sell10B, notes)
             VALUES(%s, %s, %s, %s, %s, %s, %s, %s, %s)
             ON CONFLICT (datetime) DO UPDATE SET datetime = EXCLUDED.datetime
             RETURNING id"""

    # 0 is what the Collector reports for an empty rolling trade window -
    # stored as NULL rather than a misleading literal price of 0.
    average = None if price.average == 0 else price.average

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(
                sql,
                (
                    occurred_at,
                    average,
                    price.buy100M,
                    price.buy1B,
                    price.buy10B,
                    price.sell100M,
                    price.sell1B,
                    price.sell10B,
                    price.notes,
                ),
            )

            rows = cur.fetchone()
            conn.commit()
    except (psycopg2.DataError, psycopg2.IntegrityError) as error:
        # Bad input (e.g. a value too large for its column) - retrying the
        # same payload will never succeed, unlike a connection failure.
        try:
            conn.rollback()
        except Exception:
            pass  # connection already dead - _get_conn() reconnects next call
        logger.error("insert_price rejected invalid data: %s", _sanitize(str(error)))
        raise ValueError("Price data is invalid.") from error
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("insert_price failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to record price right now.") from error

    if not rows:
        raise RuntimeError("Unable to record price right now.")

    return rows[0]


def _row_to_record(row) -> PriceRecord:
    return PriceRecord(
        id=row[0],
        datetime=str(row[1]),
        average=row[2],
        buy100M=row[3],
        buy1B=row[4],
        buy10B=row[5],
        sell100M=row[6],
        sell1B=row[7],
        sell10B=row[8],
        notes=row[9] or "",
    )


def get_prices(
    limit: int = 10000, since: str | None = None, until: str | None = None
) -> list[PriceRecord]:
    conditions = []
    params: list = []
    if since is not None:
        conditions.append("datetime >= %s")
        params.append(since)
    if until is not None:
        conditions.append("datetime <= %s")
        params.append(until)
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    sql = f"""
        SELECT id, datetime, average, buy100M, buy1B, buy10B,
               sell100M, sell1B, sell10B, notes
        FROM price
        {where_clause}
        ORDER BY datetime ASC
        LIMIT %s
    """
    params.append(limit)

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return [_row_to_record(row) for row in cur.fetchall()]
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("get_prices failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to fetch prices right now.") from error


def get_latest_prices(limit: int = 2) -> list[PriceRecord]:
    """O(limit) via the index on datetime. Built for the watchdog Lambda
    (see infra/watchdog/), which only needs the last row or two to check
    staleness."""
    sql = """
        SELECT id, datetime, average, buy100M, buy1B, buy10B,
               sell100M, sell1B, sell10B, notes
        FROM price
        ORDER BY datetime DESC
        LIMIT %s
    """

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, (limit,))
            return [_row_to_record(row) for row in cur.fetchall()]
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("get_latest_prices failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to fetch the latest prices right now.") from error


def get_forecast_training_prices(since: str | None = None) -> list[PriceRecord]:
    """Excludes notes = 'manual' (test/backfill entries, not the automated
    Collector feed) - unlike get_prices, which still shows them on the
    full displayed chart."""
    conditions = ["notes != 'manual'"]
    params: list = []
    if since is not None:
        conditions.append("datetime >= %s")
        params.append(since)
    where_clause = f"WHERE {' AND '.join(conditions)}"

    sql = f"""
        SELECT id, datetime, average, buy100M, buy1B, buy10B,
               sell100M, sell1B, sell10B, notes
        FROM price
        {where_clause}
        ORDER BY datetime ASC
    """

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return [_row_to_record(row) for row in cur.fetchall()]
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("get_forecast_training_prices failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to fetch forecast training prices right now.") from error


def upsert_forecast_cache(model: str, model_params, points, history_count: int) -> None:
    sql = """
        INSERT INTO forecast_cache (id, model, model_params, points, history_count)
        VALUES (1, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            updated_at = now(),
            model = EXCLUDED.model,
            model_params = EXCLUDED.model_params,
            points = EXCLUDED.points,
            history_count = EXCLUDED.history_count
    """

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(
                sql,
                (model, Json(model_params) if model_params is not None else None, Json(points), history_count),
            )
            conn.commit()
    except (psycopg2.DataError, psycopg2.IntegrityError) as error:
        try:
            conn.rollback()
        except Exception:
            pass
        logger.error("upsert_forecast_cache rejected invalid data: %s", _sanitize(str(error)))
        raise ValueError("Forecast cache data is invalid.") from error
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("upsert_forecast_cache failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to save the precomputed forecast right now.") from error


def get_forecast_cache() -> Forecast | None:
    sql = "SELECT model, model_params, points, history_count, updated_at FROM forecast_cache WHERE id = 1"

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(sql)
            row = cur.fetchone()
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("get_forecast_cache failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to fetch the precomputed forecast right now.") from error

    if not row:
        return None

    return Forecast(model=row[0], model_params=row[1], points=row[2], history_count=row[3], updated_at=str(row[4]))


def insert_forecast_snapshot(history_count: int, points, model: str, model_params, user_id: str | None = None) -> int:
    sql = """INSERT INTO forecast_snapshot(model, model_params, points, history_count, user_id)
             VALUES(%s, %s, %s, %s, %s) RETURNING id"""

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(
                sql,
                (
                    model,
                    Json(model_params) if model_params is not None else None,
                    Json(points),
                    history_count,
                    user_id,
                ),
            )
            rows = cur.fetchone()
            conn.commit()
    except (psycopg2.DataError, psycopg2.IntegrityError) as error:
        try:
            conn.rollback()
        except Exception:
            pass
        logger.error("insert_forecast_snapshot rejected invalid data: %s", _sanitize(str(error)))
        raise ValueError("Forecast snapshot data is invalid.") from error
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("insert_forecast_snapshot failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to save forecast snapshot right now.") from error

    if not rows:
        raise RuntimeError("Unable to save forecast snapshot right now.")

    return rows[0]


def get_forecast_snapshots(limit: int = 50, user_id: str | None = None) -> list[ForecastSnapshotRecord]:
    # Userless (automated) snapshots are visible to everyone; a snapshot with
    # an owner is visible only to that owner, logged-out visitors see none.
    where = "user_id IS NULL" if user_id is None else "(user_id IS NULL OR user_id = %s)"
    params = (limit,) if user_id is None else (user_id, limit)
    sql = f"""
        SELECT id, created_at, model, model_params, points, history_count, user_id
        FROM forecast_snapshot
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT %s
    """

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return [_row_to_forecast_snapshot_record(row) for row in cur.fetchall()]
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("get_forecast_snapshots failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to fetch forecast snapshots right now.") from error


def _row_to_forecast_snapshot_record(row) -> ForecastSnapshotRecord:
    return ForecastSnapshotRecord(
        id=row[0],
        created_at=str(row[1]),
        model=row[2],
        model_params=row[3],
        points=row[4],
        history_count=row[5],
        user_id=str(row[6]) if row[6] is not None else None,
    )


def delete_forecast_snapshot(id: int) -> bool:
    sql = "DELETE FROM forecast_snapshot WHERE id = %s"

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, (id,))
            deleted = cur.rowcount > 0
            conn.commit()
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("delete_forecast_snapshot failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to delete forecast snapshot right now.") from error

    return deleted


_DISCORD_WEBHOOK_PATTERN = re.compile(r"^https://discord(app)?\.com/api/webhooks/")


def _validate_webhook_url(url: str) -> None:
    if not _DISCORD_WEBHOOK_PATTERN.match(url):
        raise ValueError("That doesn't look like a Discord webhook URL.")


def _validate_thresholds(high: float | None, low: float | None) -> None:
    if high is None and low is None:
        raise ValueError("Set at least one of high or low - otherwise this alert would never fire.")


def create_alert_subscription(
    user_id: str, webhook_url: str, name: str, high: float | None, low: float | None
) -> AlertSubscription:
    _validate_webhook_url(webhook_url)
    _validate_thresholds(high, low)
    sql = """INSERT INTO alert_subscription(user_id, webhook_url, name, high, low)
             VALUES(%s, %s, %s, %s, %s) RETURNING id, webhook_url, name, high, low"""

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, (user_id, webhook_url, name, high, low))
            row = cur.fetchone()
            conn.commit()
    except psycopg2.errors.UniqueViolation as error:
        try:
            conn.rollback()
        except Exception:
            pass
        logger.error("create_alert_subscription rejected a duplicate webhook: %s", _sanitize(str(error)))
        raise ValueError("You already have an alert on that webhook - edit it instead.") from error
    except (psycopg2.DataError, psycopg2.IntegrityError) as error:
        try:
            conn.rollback()
        except Exception:
            pass
        logger.error("create_alert_subscription rejected invalid data: %s", _sanitize(str(error)))
        raise ValueError("Alert subscription data is invalid.") from error
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("create_alert_subscription failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to create the alert subscription right now.") from error

    if not row:
        raise RuntimeError("Unable to create the alert subscription right now.")

    return _row_to_alert_subscription(row)


def _row_to_alert_subscription(row) -> AlertSubscription:
    return AlertSubscription(id=row[0], webhook_url=row[1], name=row[2], high=row[3], low=row[4])


def update_alert_subscription(
    user_id: str, id: int, name: str, high: float | None, low: float | None
) -> AlertSubscription | None:
    _validate_thresholds(high, low)
    sql = """UPDATE alert_subscription SET name = %s, high = %s, low = %s
             WHERE id = %s AND user_id = %s
             RETURNING id, webhook_url, name, high, low"""

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, (name, high, low, id, user_id))
            row = cur.fetchone()
            conn.commit()
    except (psycopg2.DataError, psycopg2.IntegrityError) as error:
        try:
            conn.rollback()
        except Exception:
            pass
        logger.error("update_alert_subscription rejected invalid data: %s", _sanitize(str(error)))
        raise ValueError("Alert subscription data is invalid.") from error
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("update_alert_subscription failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to update the alert subscription right now.") from error

    return _row_to_alert_subscription(row) if row else None


def delete_alert_subscription(user_id: str, id: int) -> bool:
    sql = "DELETE FROM alert_subscription WHERE id = %s AND user_id = %s"

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, (id, user_id))
            deleted = cur.rowcount > 0
            conn.commit()
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("delete_alert_subscription failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to delete the alert subscription right now.") from error

    return deleted


def get_alert_subscriptions_for_user(user_id: str) -> list[AlertSubscription]:
    sql = """SELECT id, webhook_url, name, high, low FROM alert_subscription
             WHERE user_id = %s ORDER BY created_at DESC"""

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, (user_id,))
            return [_row_to_alert_subscription(row) for row in cur.fetchall()]
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("get_alert_subscriptions_for_user failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to fetch alert subscriptions right now.") from error


def get_alert_subscriptions() -> list[dict]:
    # No user filter and plain dicts, not AlertSubscription - this is for the
    # watchdog Lambda (see infra/watchdog/), which needs every subscription
    # regardless of owner to actually send alerts. Never exposed via schema.py.
    sql = "SELECT id, webhook_url, name, high, low, last_alerted_at FROM alert_subscription"

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(sql)
            # high/low come back as Decimal; Flask's jsonify serializes Decimal
            # as a string (not a number), which would break the watchdog's
            # numeric comparisons against the GraphQL API's float values.
            return [
                {
                    "id": row[0],
                    "webhook_url": row[1],
                    "name": row[2],
                    "high": float(row[3]) if row[3] is not None else None,
                    "low": float(row[4]) if row[4] is not None else None,
                    "last_alerted_at": row[5].isoformat() if row[5] is not None else None,
                }
                for row in cur.fetchall()
            ]
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("get_alert_subscriptions failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to fetch alert subscriptions right now.") from error


def set_alert_subscription_notified(id: int, notified: bool) -> None:
    # Lets the watchdog Lambda record that it just alerted on a crossing (so
    # it can suppress repeats until the reminder interval elapses) or that
    # the condition cleared (so the next crossing alerts right away rather
    # than waiting out a stale interval). now() is computed in Postgres to
    # avoid clock skew between the watchdog, this Lambda, and the database.
    sql = "UPDATE alert_subscription SET last_alerted_at = CASE WHEN %s THEN now() ELSE NULL END WHERE id = %s"

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, (notified, id))
            conn.commit()
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("set_alert_subscription_notified failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to update the alert subscription right now.") from error
