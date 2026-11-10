import os
from datetime import datetime, timezone

import strawberry
from strawberry.extensions import DisableIntrospection
from strawberry.types import Info

from auth import get_current_user
from database import (
    create_alert_subscription as db_create_alert_subscription,
    delete_alert_subscription as db_delete_alert_subscription,
    delete_forecast_snapshot as db_delete_forecast_snapshot,
    get_alert_subscriptions_for_user,
    get_forecast_cache,
    get_forecast_snapshots,
    get_latest_prices,
    get_prices,
    insert_forecast_snapshot,
    insert_price,
    update_alert_subscription as db_update_alert_subscription,
)
from models import AlertSubscription, Forecast, ForecastSnapshotRecord, PriceInput, PriceRecord, User
from strawberry.scalars import JSON

PRICE_FIELDS = ("average", "buy100M", "buy1B", "buy10B", "sell100M", "sell1B", "sell10B")
RECORD_PRICE_SECRET_HEADER = "x-record-price-secret"
FORECAST_SNAPSHOT_SECRET_HEADER = "x-forecast-snapshot-secret"


@strawberry.type
class Mutation:
    @strawberry.mutation
    def record_price(self, info: Info, price: PriceInput) -> str:
        _check_write_auth(info)
        _validate_price(price)
        occurred_at = price.datetime or datetime.now(timezone.utc).isoformat()
        try:
            price_id = insert_price(price, occurred_at)
        except RuntimeError:
            # GraphQL otherwise always returns 200, even on a resolver error.
            info.context["response"].status_code = 503
            raise
        return str(price_id)

    @strawberry.mutation
    def record_forecast_snapshot(
        self,
        info: Info,
        history_count: int,
        points: JSON,
        model: str,
        model_params: JSON | None = None,
    ) -> ForecastSnapshotRecord:
        _check_forecast_snapshot_write_auth(info)
        user = get_current_user(info)
        user_id = user["id"] if user else None
        created_at = datetime.now(timezone.utc).isoformat()
        snapshot_id = insert_forecast_snapshot(history_count, points, model, model_params, user_id)
        return ForecastSnapshotRecord(
            id=snapshot_id,
            created_at=created_at,
            model=model,
            model_params=model_params,
            points=points,
            history_count=history_count,
            user_id=user_id,
        )

    @strawberry.mutation
    def delete_forecast_snapshot(self, info: Info, id: int) -> bool:
        _check_forecast_snapshot_write_auth(info)
        return db_delete_forecast_snapshot(id)

    @strawberry.mutation
    def create_alert_subscription(
        self, info: Info, webhook_url: str, name: str, high: float | None = None, low: float | None = None
    ) -> AlertSubscription:
        user = _require_user(info)
        return db_create_alert_subscription(user["id"], webhook_url, name, high, low)

    @strawberry.mutation
    def update_alert_subscription(
        self, info: Info, id: int, name: str, high: float | None = None, low: float | None = None
    ) -> AlertSubscription:
        user = _require_user(info)
        subscription = db_update_alert_subscription(user["id"], id, name, high, low)
        if subscription is None:
            raise ValueError("No alert subscription with that id.")
        return subscription

    @strawberry.mutation
    def delete_alert_subscription(self, info: Info, id: int) -> bool:
        user = _require_user(info)
        return db_delete_alert_subscription(user["id"], id)


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
        """Built for the staleness watchdog."""
        return get_latest_prices(limit)

    @strawberry.field
    def forecast(self) -> Forecast | None:
        """Null before the first scheduled run has populated it.
        An hourly EventBridge trigger invokes /internal/trigger, which fits
        and caches a new forecast via forecasting.compute_forecast."""
        return get_forecast_cache()

    @strawberry.field
    def forecast_snapshots(self, info: Info, limit: int = 50) -> list[ForecastSnapshotRecord]:
        user = get_current_user(info)
        return get_forecast_snapshots(limit, user["id"] if user else None)

    @strawberry.field
    def me(self, info: Info) -> User | None:
        user = get_current_user(info)
        return User(**user) if user else None

    @strawberry.field
    def my_alert_subscriptions(self, info: Info) -> list[AlertSubscription]:
        user = _require_user(info)
        return get_alert_subscriptions_for_user(user["id"])


def _check_write_auth(info: Info) -> None:
    """Gate writes behind a shared secret - recordPrice is otherwise open to
    anyone who finds the endpoint."""
    expected = os.environ.get("RECORD_PRICE_SECRET")
    if not expected:
        raise PermissionError("Writes are not configured.")

    provided = info.context["request"].headers.get(RECORD_PRICE_SECRET_HEADER)
    if provided != expected:
        raise PermissionError("Invalid or missing credentials.")


def _validate_price(price: PriceInput) -> None:
    _parse_datetime_arg("datetime", price.datetime)

    for field in PRICE_FIELDS:
        value = getattr(price, field)
        # Only average can be 0 - an empty rolling trade window.
        if field == "average" and value == 0:
            continue
        if value <= 0:
            raise ValueError(f"{field} must be greater than 0, got {value}.")


def _parse_datetime_arg(name: str, value: str | None) -> None:
    if value is None:
        return
    try:
        datetime.fromisoformat(value)
    except ValueError:
        raise ValueError(f"Invalid {name}: '{value}'. Expected ISO 8601 format.")


def _require_user(info: Info) -> dict:
    user = get_current_user(info)
    if user is None:
        raise PermissionError("You must be logged in.")
    return user


def _check_forecast_snapshot_write_auth(info: Info) -> None:
    """Gates forecast-snapshot writes - this secret is held by the
    Vercel-hosted frontend on behalf of site visitors, not an external bot."""
    expected = os.environ.get("FORECAST_SNAPSHOT_SECRET")
    if not expected:
        raise PermissionError("Writes are not configured.")

    provided = info.context["request"].headers.get(FORECAST_SNAPSHOT_SECRET_HEADER)
    if provided != expected:
        raise PermissionError("Invalid or missing credentials.")


# Introspection/GraphiQL expose the exact schema to anyone who finds the
# endpoint - off by default in production (GRAPHQL_INTROSPECTION_ENABLED=false
# in Terraform), on locally for convenience.
_introspection_enabled = os.environ.get("GRAPHQL_INTROSPECTION_ENABLED", "true").lower() != "false"
_extensions = [] if _introspection_enabled else [DisableIntrospection]

schema = strawberry.Schema(query=Query, mutation=Mutation, extensions=_extensions)
