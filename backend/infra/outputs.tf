output "backend_url" {
  description = "Lambda Function URL for the backend (set as BACKEND_URL in frontend)"
  value       = aws_lambda_function_url.backend.function_url
}
