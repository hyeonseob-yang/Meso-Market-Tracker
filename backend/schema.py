import strawberry

from database import insert_price
from models import PriceInput


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


schema = strawberry.Schema(query=Query, mutation=Mutation)
