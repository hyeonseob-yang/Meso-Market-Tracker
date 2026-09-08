import strawberry

from database import get_prices, insert_price
from models import PriceInput, PriceRecord


@strawberry.type
class Mutation:
    @strawberry.mutation
    def record_price(self, price: PriceInput) -> str:
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
