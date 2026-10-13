# Two EventBridge rules invoking the main backend Lambda directly (not
# through API Gateway) - the Lambda Web Adapter's pass-through-path feature
# forwards each invocation's event payload to AWS_LWA_PASS_THROUGH_PATH as
# a POST body, which app.py's /internal/trigger route reads. Both share
# that one route/secret since the adapter only supports a single
# pass-through path per function - the `action` field in each rule's
# input dispatches to the right behavior.

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
