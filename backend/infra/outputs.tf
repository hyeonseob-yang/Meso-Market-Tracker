output "backend_url" {
  description = "API Gateway URL for the backend (set as BACKEND_URL in frontend)"
  value       = aws_apigatewayv2_stage.default.invoke_url
}
