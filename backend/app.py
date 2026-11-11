import os

from flask import Flask, jsonify, request
from strawberry.flask.views import GraphQLView

from database import (
    get_alert_subscriptions,
    get_forecast_cache,
    insert_forecast_snapshot,
    set_alert_subscription_notified,
    upsert_forecast_cache,
)
from schema import schema

app = Flask(__name__)

_introspection_enabled = os.environ.get("GRAPHQL_INTROSPECTION_ENABLED", "true").lower() != "false"

app.add_url_rule(
    "/price",
    view_func=GraphQLView.as_view(
        "graphql_view",
        schema=schema,
        graphql_ide="graphiql" if _introspection_enabled else None,
    ),
)


@app.route("/internal/trigger", methods=["POST"])
def internal_trigger():
    """Reached two ways: EventBridge invoking this Lambda directly (see
    infra/), or the public internet via API Gateway's $default route -
    hence the secret check. Both scheduled triggers share this route since
    the Lambda Web Adapter only supports one pass-through path per function."""
    expected = os.environ.get("INTERNAL_TRIGGER_SECRET")
    body = request.get_json(silent=True) or {}
    if not expected or body.get("secret") != expected:
        return "", 403

    action = body.get("action")
    if action == "precompute":
        # Deferred: forecasting.py pulls in sktime/pandas/statsmodels, which
        # would otherwise tax every cold start, including requests that
        # never touch forecasting.
        from forecasting import compute_forecast

        forecast = compute_forecast()
        upsert_forecast_cache(forecast.model, forecast.model_params, forecast.points, forecast.history_count)
    elif action == "snapshot_daily":
        cached = get_forecast_cache()
        if cached is None:
            return "", 200  # nothing precomputed yet - quiet no-op, not an error
        insert_forecast_snapshot(cached.history_count, cached.points, cached.model, cached.model_params)
    else:
        return "", 400
    return "", 200


@app.route("/internal/alert-subscriptions", methods=["GET"])
def internal_alert_subscriptions():
    """Gated separately from /internal/trigger: this route has no EventBridge
    invoke path at all (the Lambda Web Adapter's pass-through always targets
    /internal/trigger), so the only way in is a real HTTP call from the
    watchdog Lambda - WATCHDOG_SECRET is what actually protects it."""
    expected = os.environ.get("WATCHDOG_SECRET")
    if not expected or request.headers.get("x-watchdog-secret") != expected:
        return "", 403
    return jsonify(get_alert_subscriptions())


@app.route("/internal/alert-subscriptions/<int:id>/notified", methods=["POST"])
def internal_alert_subscription_notified(id):
    """Lets the watchdog Lambda record whether it just alerted on this
    subscription's crossing, so it knows whether to suppress or send the
    next one. Same secret-gating as the GET route above, for the same
    reason - this is the only write path the watchdog has into the DB."""
    expected = os.environ.get("WATCHDOG_SECRET")
    if not expected or request.headers.get("x-watchdog-secret") != expected:
        return "", 403
    body = request.get_json(silent=True) or {}
    set_alert_subscription_notified(id, bool(body.get("notified")))
    return "", 204
