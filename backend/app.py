import os

from flask import Flask, request
from strawberry.flask.views import GraphQLView

from database import get_forecast_cache, insert_forecast_snapshot, upsert_forecast_cache
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
    """Reached two ways: EventBridge invoking this Lambda directly (the
    legitimate path - see infra/, Lambda Web Adapter's pass-through-path
    feature forwards that invocation's event payload here as the POST
    body), or the public internet via API Gateway's $default catch-all
    route (since this path isn't otherwise restricted) - hence the secret
    check. Both scheduled triggers share this one route/secret since the
    adapter only supports a single pass-through path per function."""
    expected = os.environ.get("INTERNAL_TRIGGER_SECRET")
    body = request.get_json(silent=True) or {}
    if not expected or body.get("secret") != expected:
        return "", 403

    action = body.get("action")
    if action == "precompute":
        # Deferred: forecasting.py pulls in sktime/pandas/statsmodels, which
        # would otherwise tax every cold start - including /price and
        # snapshot_daily, neither of which need it. Only this branch pays
        # the import cost, and only once per warm container.
        from forecasting import compute_forecast

        forecast = compute_forecast()
        upsert_forecast_cache(forecast.model, forecast.model_params, forecast.points, forecast.history)
    elif action == "snapshot_daily":
        cached = get_forecast_cache()
        if cached is None:
            return "", 200  # nothing precomputed yet - quiet no-op, not an error
        # cached.history is the exact training data the cached forecast was
        # fit on (notes='manual' already excluded) - no need to re-derive it.
        insert_forecast_snapshot(cached.history, cached.points, cached.model, cached.model_params)
    else:
        return "", 400
    return "", 200
