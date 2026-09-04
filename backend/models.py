import strawberry


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
