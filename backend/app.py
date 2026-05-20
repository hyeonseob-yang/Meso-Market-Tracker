from flask import Flask, request

from database import insert_price

app = Flask(__name__)


@app.route("/price", methods=["POST"])
def post_price(**cfg):
    if request.method == "POST":
        form = request.form
        price = form

        price_id = insert_price(price)
        return "<p>Inserted id: " + str(price_id) + "</p>"
    # TODO: throw correct error
    return "Method does not exist"
