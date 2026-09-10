terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment and fill in once you have an S3 bucket for state:
  # backend "s3" {
  #   bucket = "your-tf-state-bucket"
  #   key    = "meso-market/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "meso-market"
      Environment = var.env
      ManagedBy   = "terraform"
    }
  }
}
