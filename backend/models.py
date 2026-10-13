import dataclasses
import strawberry
from strawberry.scalars import JSON


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


@strawberry.type
class Forecast:
    model: str
    model_params: JSON | None
    points: JSON  # list[{datetime, predicted, lower, upper}]
    history_count: int  # how many training records were used (notes='manual' already excluded)
    updated_at: str | None = None  # only set when read back from the cache (get_forecast_cache)

    @strawberry.field
    def history(self) -> JSON:
        """Computed on read, not stored - the last history_count non-manual
        records before updated_at. Can drift slightly if a backfill lands
        afterward; acceptable for display purposes."""
        if self.updated_at is None:
            return []
        from database import get_recent_training_prices

        records = get_recent_training_prices(before=self.updated_at, limit=self.history_count)
        return [{"datetime": r.datetime, "average": r.average} for r in records]


@strawberry.type
class ForecastSnapshotRecord:
    id: int
    created_at: str
    model: str
    model_params: JSON | None
    points: JSON
    history_count: int

    @strawberry.field
    def history(self) -> JSON:
        from database import get_recent_training_prices

        records = get_recent_training_prices(before=self.created_at, limit=self.history_count)
        return [{"datetime": r.datetime, "average": r.average} for r in records]
