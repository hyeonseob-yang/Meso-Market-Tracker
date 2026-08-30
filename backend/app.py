from flask import Flask, request
from flasgger import Swagger

from database import insert_price

app = Flask(__name__)
swagger = Swagger(app)


@app.route("/price", methods=["POST"])
def post_price(**cfg):
    """
    Record a meso market price entry.
    ---
    consumes:
      - application/x-www-form-urlencoded
    parameters:
      - in: formData
        name: datetime
        type: string
        required: true
        description: ISO 8601 timestamp of the price snapshot
      - in: formData
        name: average
        type: number
        required: true
        description: Average meso market rate
      - in: formData
        name: buy100M
        type: number
        required: true
        description: Buy price for 100M mesos
      - in: formData
        name: buy1B
        type: number
        required: true
        description: Buy price for 1B mesos
      - in: formData
        name: buy10B
        type: number
        required: true
        description: Buy price for 10B mesos
      - in: formData
        name: sell100M
        type: number
        required: true
        description: Sell price for 100M mesos
      - in: formData
        name: sell1B
        type: number
        required: true
        description: Sell price for 1B mesos
      - in: formData
        name: sell10B
        type: number
        required: true
        description: Sell price for 10B mesos
      - in: formData
        name: notes
        type: string
        required: false
        description: Optional notes for this entry
    responses:
      200:
        description: ID of the inserted price record
        schema:
          type: string
          example: "<p>Inserted id: 42</p>"
    """
    if request.method == "POST":
        form = request.form
        price = form

        price_id = insert_price(price)
        return "<p>Inserted id: " + str(price_id) + "</p>"
    # TODO: throw correct error
    return "Method does not exist"
