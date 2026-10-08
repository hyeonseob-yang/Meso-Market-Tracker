import os
from datetime import datetime, timezone

import strawberry
from strawberry.extensions import DisableIntrospection
from strawberry.types import Info

from database import get_latest_prices, get_prices, insert_price
from models import PriceInput, PriceRecord

PRICE_FIELDS = ("average", "buy100M", "buy1B", "buy10B", "sell100M", "sell1B", "sell10B")
RECORD_PRICE_SECRET_HEADER = "x-record-price-secret"


def _parse_datetime_arg(name: str, value: str | None) -> None:
    if value is None:
        return
    try:
        datetime.fromisoformat(value)
    except ValueError:
        raise ValueError(f"Invalid {name}: '{value}'. Expected ISO 8601 format.")


def _validate_price(price: PriceInput) -> None:
    _parse_datetime_arg("datetime", price.datetime)

    for field in PRICE_FIELDS:
        value = getattr(price, field)
        if value <= 0:
            raise ValueError(f"{field} must be greater than 0, got {value}.")


def _check_write_auth(info: Info) -> None:
    """Gate writes behind a shared secret - recordPrice is otherwise open to
    anyone who finds the endpoint. Fails closed: if the secret isn't
    configured at all, writes are refused rather than silently left open."""
    expected = os.environ.get("RECORD_PRICE_SECRET")
    if not expected:
        raise PermissionError("Writes are not configured.")

    provided = info.context["request"].headers.get(RECORD_PRICE_SECRET_HEADER)
    if provided != expected:
        raise PermissionError("Invalid or missing credentials.")


@strawberry.type
class Mutation:
    @strawberry.mutation
    def record_price(self, info: Info, price: PriceInput) -> str:
        _check_write_auth(info)
        _validate_price(price)
        occurred_at = price.datetime or datetime.now(timezone.utc).isoformat()
        price_id = insert_price(price, occurred_at)
        return str(price_id)


@strawberry.type
class Query:
    @strawberry.field
    def health(self) -> str:
        return "ok"

    @strawberry.field
    def prices(
        self, since: str | None = None, until: str | None = None, limit: int = 10000
    ) -> list[PriceRecord]:
        _parse_datetime_arg("since", since)
        _parse_datetime_arg("until", until)
        return get_prices(limit, since, until)

    @strawberry.field
    def latest_prices(self, limit: int = 2) -> list[PriceRecord]:
        """Most recent rows, newest first - cheap even against a large
        table, unlike paging through `prices` to find the tail end of its
        oldest-first ordering. Built for the staleness watchdog."""
        return get_latest_prices(limit)


# Introspection/GraphiQL make the schema self-documenting, which is
# convenient for local dev but means anyone who finds the deployed endpoint
# can discover the exact mutation shape with zero effort. Off by default in
# a real deployment (set via GRAPHQL_INTROSPECTION_ENABLED=false in Terraform);
# on locally, where .env doesn't set it, for easier manual testing.
_introspection_enabled = os.environ.get("GRAPHQL_INTROSPECTION_ENABLED", "true").lower() != "false"
_extensions = [] if _introspection_enabled else [DisableIntrospection]

schema = strawberry.Schema(query=Query, mutation=Mutation, extensions=_extensions)
