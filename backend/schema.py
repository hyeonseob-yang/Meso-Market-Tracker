import logging
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone

import strawberry

from database import get_prices, insert_price
from models import PriceInput, PriceRecord

logger = logging.getLogger(__name__)

PRICE_FIELDS = ("average", "buy100M", "buy1B", "buy10B", "sell100M", "sell1B", "sell10B")


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


def _trigger_revalidation() -> None:
    """Tell the frontend its cached page is stale, right when new data
    actually lands rather than waiting out fetchPrices' own hour-long cache
    window. Best-effort and silent on failure - a revalidation hiccup must
    never turn a successful insert into a failed mutation."""
    frontend_url = os.environ.get("FRONTEND_URL")
    secret = os.environ.get("REVALIDATE_SECRET")
    if not frontend_url or not secret:
        return

    request = urllib.request.Request(
        f"{frontend_url.rstrip('/')}/api/revalidate",
        method="POST",
        headers={"x-revalidate-secret": secret},
    )
    try:
        urllib.request.urlopen(request, timeout=5)
    except (urllib.error.URLError, OSError) as error:
        logger.error("revalidation request failed: %s", error)


@strawberry.type
class Mutation:
    @strawberry.mutation
    def record_price(self, price: PriceInput) -> str:
        _validate_price(price)
        occurred_at = price.datetime or datetime.now(timezone.utc).isoformat()
        price_id = insert_price(price, occurred_at)
        _trigger_revalidation()
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


schema = strawberry.Schema(query=Query, mutation=Mutation)
