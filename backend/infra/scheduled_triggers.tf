# Both rules invoke the backend Lambda directly (not via API Gateway) - the
# Lambda Web Adapter forwards the invocation payload to app.py's
# /internal/trigger route as a POST body. They share that route/secret
# since the adapter only supports one pass-through path per function; the
# `action` field dispatches to the right behavior.

resource "aws_cloudwatch_event_rule" "forecast_precompute_schedule" {
  name                = "meso-market-forecast-precompute"
  description         = "Refits the forecast cache at :10 past every hour, after the Collector's expected :01 post"
  schedule_expression = "cron(10 * * * ? *)"
}

resource "aws_cloudwatch_event_target" "forecast_precompute" {
  rule = aws_cloudwatch_event_rule.forecast_precompute_schedule.name
  arn  = aws_lambda_function.backend.arn
  input = jsonencode({
    secret = var.internal_trigger_secret
    action = "precompute"
  })
}

resource "aws_lambda_permission" "forecast_precompute_eventbridge" {
  statement_id  = "AllowForecastPrecomputeEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backend.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.forecast_precompute_schedule.arn
}

resource "aws_cloudwatch_event_rule" "forecast_snapshot_schedule" {
  name                = "meso-market-forecast-snapshot-daily"
  description         = "Archives the current forecast cache into forecast_snapshot once a day"
  schedule_expression = "cron(5 0 * * ? *)"
}

resource "aws_cloudwatch_event_target" "forecast_snapshot" {
  rule = aws_cloudwatch_event_rule.forecast_snapshot_schedule.name
  arn  = aws_lambda_function.backend.arn
  input = jsonencode({
    secret = var.internal_trigger_secret
    action = "snapshot_daily"
  })
}

resource "aws_lambda_permission" "forecast_snapshot_eventbridge" {
  statement_id  = "AllowForecastSnapshotEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backend.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.forecast_snapshot_schedule.arn
}
