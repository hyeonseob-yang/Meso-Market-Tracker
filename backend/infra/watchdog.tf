# Hourly staleness check, alerting to Discord. Stdlib-only Python, so a
# plain zip rather than the container-image setup the main backend needs
# for its dependencies.
data "archive_file" "watchdog" {
  type        = "zip"
  source_file = "${path.module}/watchdog/handler.py"
  output_path = "${path.module}/watchdog/handler.zip"
}

resource "aws_iam_role" "watchdog_exec" {
  name = "meso-market-watchdog"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "watchdog_basic" {
  role       = aws_iam_role.watchdog_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_cloudwatch_log_group" "watchdog" {
  name              = "/aws/lambda/meso-market-watchdog"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "watchdog" {
  function_name = "meso-market-watchdog"
  role          = aws_iam_role.watchdog_exec.arn
  handler       = "handler.handler"
  runtime       = "python3.12"
  timeout       = 30
  memory_size   = 128

  filename         = data.archive_file.watchdog.output_path
  source_code_hash = data.archive_file.watchdog.output_base64sha256

  environment {
    variables = {
      # Same API this project's own frontend calls - no separate URL to keep in sync.
      TRACKER_API_URL         = "${aws_apigatewayv2_stage.default.invoke_url}/price"
      DISCORD_WEBHOOK_URL     = var.discord_webhook_url
      ALERT_SUBSCRIPTIONS_URL = "${aws_apigatewayv2_stage.default.invoke_url}/internal/alert-subscriptions"
      WATCHDOG_SECRET         = var.watchdog_secret
    }
  }

  depends_on = [aws_cloudwatch_log_group.watchdog]
}

# Price/breakpoint checks are time-sensitive (an alert should fire soon
# after a crossing), so they run at :10, right after the Collector's ~:01
# post - rather than waiting for the :30 slot below.
resource "aws_cloudwatch_event_rule" "watchdog_prices_schedule" {
  name                = "meso-market-watchdog-prices"
  description         = "Runs the price staleness and breakpoint-alert checks at :10 past every hour"
  schedule_expression = "cron(10 * * * ? *)"
}

resource "aws_cloudwatch_event_target" "watchdog_prices" {
  rule  = aws_cloudwatch_event_rule.watchdog_prices_schedule.name
  arn   = aws_lambda_function.watchdog.arn
  input = jsonencode({ checks = "prices" })
}

resource "aws_lambda_permission" "watchdog_prices_eventbridge" {
  statement_id  = "AllowPricesEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.watchdog.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.watchdog_prices_schedule.arn
}

# Forecast staleness isn't time-sensitive - runs at :30, after precompute's
# own :10 run has had a chance to complete.
resource "aws_cloudwatch_event_rule" "watchdog_health_schedule" {
  name                = "meso-market-watchdog-health"
  description         = "Runs the forecast staleness check at :30 past every hour"
  schedule_expression = "cron(30 * * * ? *)"
}

resource "aws_cloudwatch_event_target" "watchdog_health" {
  rule  = aws_cloudwatch_event_rule.watchdog_health_schedule.name
  arn   = aws_lambda_function.watchdog.arn
  input = jsonencode({ checks = "health" })
}

resource "aws_lambda_permission" "watchdog_health_eventbridge" {
  statement_id  = "AllowHealthEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.watchdog.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.watchdog_health_schedule.arn
}

# Snapshot staleness only needs checking once a day - the archive job itself
# only runs once a day, at :30 past midnight UTC. Runs 30 min after that.
resource "aws_cloudwatch_event_rule" "watchdog_snapshot_schedule" {
  name                = "meso-market-watchdog-snapshot"
  description         = "Runs the forecast-snapshot staleness check once a day at 01:00 UTC"
  schedule_expression = "cron(0 1 * * ? *)"
}

resource "aws_cloudwatch_event_target" "watchdog_snapshot" {
  rule  = aws_cloudwatch_event_rule.watchdog_snapshot_schedule.name
  arn   = aws_lambda_function.watchdog.arn
  input = jsonencode({ checks = "snapshot" })
}

resource "aws_lambda_permission" "watchdog_snapshot_eventbridge" {
  statement_id  = "AllowSnapshotEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.watchdog.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.watchdog_snapshot_schedule.arn
}
