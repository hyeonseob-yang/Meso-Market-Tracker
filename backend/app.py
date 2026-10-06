import os

from flask import Flask
from strawberry.flask.views import GraphQLView

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
