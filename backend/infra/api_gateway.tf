resource "aws_apigatewayv2_api" "backend" {
  name          = "meso-market-backend"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["POST", "OPTIONS"]
    allow_headers = ["Content-Type", "x-record-price-secret"]
    max_age       = 86400
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.backend.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.backend.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.backend.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.backend.id
  name        = "$default"
  auto_deploy = true

  # A backstop against volume abuse, shared across all callers (API Gateway
  # throttling here has no concept of "per visitor" - see Usage Plans/API
  # keys for that, not set up). Sized to comfortably absorb several real
  # users clicking through the date-window buttons at once - a dozen people
  # each firing 5 requests in a burst is ~60, well under the burst limit -
  # while still capping a genuinely abusive flood, which needs rates far
  # beyond anything human clicking produces.
  default_route_settings {
    throttling_burst_limit = 100
    throttling_rate_limit  = 30
  }
}
