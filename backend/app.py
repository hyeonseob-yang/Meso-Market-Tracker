from flask import Flask
from strawberry.flask.views import GraphQLView

from schema import schema

app = Flask(__name__)

app.add_url_rule(
    "/price",
    view_func=GraphQLView.as_view("graphql_view", schema=schema),
)
