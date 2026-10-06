variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "env" {
  description = "Environment name (e.g. prod, staging)"
  type        = string
  default     = "prod"
}

variable "db_host" {
  description = "Supabase DB host"
  type        = string
  sensitive   = true
}

variable "db_port" {
  description = "Supabase DB port"
  type        = string
  default     = "6543"
}

variable "db_name" {
  description = "Supabase DB name"
  type        = string
  sensitive   = true
}

variable "db_user" {
  description = "Supabase DB user"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Supabase DB password"
  type        = string
  sensitive   = true
}

variable "log_retention_days" {
  description = "How long to keep Lambda CloudWatch logs"
  type        = number
  default     = 14
}

variable "frontend_url" {
  description = "Deployed Vercel URL, used to call /api/revalidate after a successful recordPrice"
  type        = string
}

variable "revalidate_secret" {
  description = "Shared secret for the frontend's /api/revalidate endpoint (must match REVALIDATE_SECRET in Vercel)"
  type        = string
  sensitive   = true
}
