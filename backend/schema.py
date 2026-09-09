from datetime import datetime

import strawberry

from database import get_prices, insert_price
from models import PriceInput, PriceRecord

PRICE_FIELDS = ("average", "buy100M", "buy1B", "buy10B", "sell100M", "sell1B", "sell10B")


def _validate_price(price: PriceInput) -> None:
    try:
        datetime.fromisoformat(price.datetime)
    except ValueError:
        raise ValueError(f"Invalid datetime: '{price.datetime}'. Expected ISO 8601 format.")

    for field in PRICE_FIELDS:
        value = getattr(price, field)
        if value <= 0:
            raise ValueError(f"{field} must be greater than 0, got {value}.")


@strawberry.type
class Mutation:
    @strawberry.mutation
    def record_price(self, price: PriceInput) -> str:
        _validate_price(price)
        price_id = insert_price(price)
        return str(price_id)


@strawberry.type
class Query:
    @strawberry.field
    def health(self) -> str:
        return "ok"

    @strawberry.field
    def prices(self, limit: int = 1000) -> list[PriceRecord]:
        return get_prices(limit)


schema = strawberry.Schema(query=Query, mutation=Mutation)
