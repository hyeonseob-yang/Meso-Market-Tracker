import json
import psycopg2
from configparser import ConfigParser


def insert_price(price):
    sql = """INSERT INTO price(datetime, average, buy100M, buy1B, buy10B, sell100M, sell1B, sell10B, notes) VALUES(%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id"""

    price_id = None
    filename = "postgres.ini"
    section = "meso-market-database"
    config = get_config(filename, section)

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


def get_config(filename, section):
    parser = ConfigParser()
    parser.read(filename)

    config = {}
    if parser.has_section(section):
        key_val_tuple = parser.items(section)
        for item in key_val_tuple:
            config[item[0]] = item[1]

    return config
