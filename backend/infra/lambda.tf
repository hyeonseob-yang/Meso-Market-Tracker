# IAM role for the Lambda function
resource "aws_iam_role" "lambda_exec" {
  name = "meso-market-backend"

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

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Log group the Lambda writes to. Created up front (with retention) so AWS
# doesn't auto-create an unmanaged, never-expiring one on first invocation.
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/meso-market-backend"
  retention_in_days = var.log_retention_days
}

# Lambda function (container image)
resource "aws_lambda_function" "backend" {
  function_name = "meso-market-backend"
  role          = aws_iam_role.lambda_exec.arn
  package_type  = "Image"

  # After first `terraform apply`, build from ../Dockerfile, push, then re-apply
  image_uri = "${aws_ecr_repository.backend.repository_url}:latest"

  timeout     = 30
  memory_size = 512

  environment {
    variables = {
      DB_HOST     = var.db_host
      DB_PORT     = var.db_port
      DB_NAME     = var.db_name
      DB_USER     = var.db_user
      DB_PASSWORD = var.db_password
      PORT        = "5000"
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda]
}

# Allow API Gateway to invoke the Lambda function
resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backend.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.backend.execution_arn}/*/*"
}
