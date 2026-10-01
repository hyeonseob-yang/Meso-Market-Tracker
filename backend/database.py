import logging
import os
import re
import psycopg2
from dotenv import load_dotenv

from models import PriceInput, PriceRecord

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


def insert_price(price: PriceInput, occurred_at: str):
    sql = """INSERT INTO price(datetime, average, buy100M, buy1B, buy10B, sell100M, sell1B, sell10B, notes) VALUES(%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id"""

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(
                sql,
                (
                    occurred_at,
                    price.average,
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
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("insert_price failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to record price right now.") from error

    if not rows:
        raise RuntimeError("Unable to record price right now.")

    return rows[0]


def get_prices(limit: int = 1000) -> list[PriceRecord]:
    sql = """
        SELECT id, datetime, average, buy100M, buy1B, buy10B,
               sell100M, sell1B, sell10B, notes
        FROM price
        ORDER BY datetime ASC
        LIMIT %s
    """

    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(sql, (limit,))
            return [
                PriceRecord(
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
                for row in cur.fetchall()
            ]
    except (Exception, psycopg2.DatabaseError) as error:
        logger.error("get_prices failed: %s", _sanitize(str(error)))
        raise RuntimeError("Unable to fetch prices right now.") from error


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
