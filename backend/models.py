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
    notes: str = ""  # optional for input only
    # Optional - if omitted, the server stamps current UTC time at insert
    # (see schema.record_price). Pass it explicitly to keep a reading's
    # original time across a retry, or when backfilling from a local backup.
    datetime: str | None = None


@strawberry.type
class PriceRecord(_PriceFields):
    id: int
    datetime: str
