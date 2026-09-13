# CloudWatch log group the Vercel frontend writes its errors into directly.
# Vercel isn't an AWS service, so nothing else creates or populates this —
# the frontend calls PutLogEvents itself (see backend/infra/bootstrap_frontend_logger.sh
# for the IAM user that lets it do that).
resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/meso-market/frontend"
  retention_in_days = var.log_retention_days
}

output "frontend_log_group_name" {
  description = "CloudWatch log group name for frontend errors (set as CLOUDWATCH_LOG_GROUP in Vercel)"
  value       = aws_cloudwatch_log_group.frontend.name
}

output "frontend_log_group_arn" {
  description = "ARN of the frontend log group, used to scope the frontend-logger IAM policy"
  value       = aws_cloudwatch_log_group.frontend.arn
}
