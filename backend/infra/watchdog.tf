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
      TRACKER_API_URL     = "${aws_apigatewayv2_stage.default.invoke_url}/price"
      DISCORD_WEBHOOK_URL = var.discord_webhook_url
    }
  }

  depends_on = [aws_cloudwatch_log_group.watchdog]
}

resource "aws_cloudwatch_event_rule" "watchdog_schedule" {
  name                = "meso-market-watchdog-hourly"
  description         = "Runs the Tracker staleness watchdog at :30 past every hour"
  schedule_expression = "cron(30 * * * ? *)"
}

resource "aws_cloudwatch_event_target" "watchdog" {
  rule = aws_cloudwatch_event_rule.watchdog_schedule.name
  arn  = aws_lambda_function.watchdog.arn
}

resource "aws_lambda_permission" "watchdog_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.watchdog.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.watchdog_schedule.arn
}
