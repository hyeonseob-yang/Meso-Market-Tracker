import dataclasses
import strawberry


@dataclasses.dataclass
class _PriceFields:
    average: int
    buy100M: int
    buy1B: int
    buy10B: int
    sell100M: int
    sell1B: int
    sell10B: int
    notes: str


@strawberry.input
class PriceInput(_PriceFields):
    # No `datetime` here on purpose - the server stamps it at insert time
    # (see schema.record_price), not the client. See PriceRecord for the
    # stored/output shape, which does carry it.
    notes: str = ""  # optional for input only


@strawberry.type
class PriceRecord(_PriceFields):
    id: int
    datetime: str
