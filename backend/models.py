import dataclasses
import strawberry


@dataclasses.dataclass
class _PriceBase:
    datetime: str
    average: int
    buy100M: int
    buy1B: int
    buy10B: int
    sell100M: int
    sell1B: int
    sell10B: int
    notes: str


@strawberry.input
class PriceInput(_PriceBase):
    notes: str = ""  # optional for input only


@strawberry.type
class PriceRecord(_PriceBase):
    id: int
