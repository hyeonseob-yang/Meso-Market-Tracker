import json
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def insert_price(price):
    sql = """INSERT INTO price(datetime, average, buy100M, buy1B, buy10B, sell100M, sell1B, sell10B, notes) VALUES(%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id"""

    price_id = None
    config = get_config()

    try:
        with psycopg2.connect(**config) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    sql,
                    (
                        price["datetime"],
                        price["average"],
                        price["buy100M"],
                        price["buy1B"],
                        price["buy10B"],
                        price["sell100M"],
                        price["sell1B"],
                        price["sell10B"],
                        price["notes"],
                    ),
                )

                rows = cur.fetchone()
                if rows:
                    price_id = rows[0]

                conn.commit()
    except (Exception, psycopg2.DatabaseError) as error:
        # TODO: log to CloudWatch
        print(json.dumps(price, indent=4))
        print(error)
    finally:
        return price_id


def get_config():
    return {
        "host": os.environ["DB_HOST"],
        "port": os.environ.get("DB_PORT", "6543"),
        "dbname": os.environ["DB_NAME"],
        "user": os.environ["DB_USER"],
        "password": os.environ["DB_PASSWORD"],
        "sslmode": "require",
        "connect_timeout": 5,
    }
