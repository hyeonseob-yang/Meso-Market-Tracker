import strawberry

from database import insert_price


@strawberry.input
class PriceInput:
    datetime: str
    average: int
    buy100M: int
    buy1B: int
    buy10B: int
    sell100M: int
    sell1B: int
    sell10B: int
    notes: str = ""


@strawberry.type
class Mutation:
    @strawberry.mutation
    def record_price(self, price: PriceInput) -> str:
        price_id = insert_price(
            {
                "datetime": price.datetime,
                "average": price.average,
                "buy100M": price.buy100M,
                "buy1B": price.buy1B,
                "buy10B": price.buy10B,
                "sell100M": price.sell100M,
                "sell1B": price.sell1B,
                "sell10B": price.sell10B,
                "notes": price.notes,
            }
        )
        return str(price_id)


@strawberry.type
class Query:
    @strawberry.field
    def health(self) -> str:
        return "ok"


schema = strawberry.Schema(query=Query, mutation=Mutation)
