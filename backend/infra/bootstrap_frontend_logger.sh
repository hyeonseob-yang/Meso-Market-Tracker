#!/usr/bin/env bash
#
# One-time bootstrap: create the `meso-frontend-logger` IAM user the Vercel
# frontend uses to forward its error logs to CloudWatch.
#
# Unlike bootstrap.sh (the `meso-deploy` Terraform user), this key is
# deliberately created OUTSIDE Terraform via plain CLI calls, so the secret
# never lands in terraform.tfstate. It's scoped to exactly two actions on
# exactly one log group — nothing else.
#
# Prerequisite: `terraform apply` must have already created the log group
# (see frontend_logging.tf) so its ARN can be looked up.
#
# Run this ONCE, with AWS_PROFILE=meso-deploy (or root) active. Re-running is
# safe for the user/policy (idempotent) but always mints a NEW access key —
# IAM allows max 2 per user, so delete an old one if a third run fails.

set -euo pipefail

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_NAME=meso-frontend-logger
REGION=us-east-1

echo ">> Looking up the frontend log group ARN from Terraform state..."
LOG_GROUP_ARN=$(terraform -chdir="$INFRA_DIR" output -raw frontend_log_group_arn)
LOG_GROUP_NAME=$(terraform -chdir="$INFRA_DIR" output -raw frontend_log_group_name)
echo "   $LOG_GROUP_NAME"

echo ">> Creating IAM user '$USER_NAME' (ignored if it already exists)..."
aws iam create-user --user-name "$USER_NAME" 2>/dev/null || echo "   user already exists"

echo ">> Attaching an inline policy scoped to just this log group..."
POLICY_JSON=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "${LOG_GROUP_ARN}:*"
    }
  ]
}
EOF
)
aws iam put-user-policy \
  --user-name "$USER_NAME" \
  --policy-name cloudwatch-put-logs \
  --policy-document "$POLICY_JSON"

echo ">> Creating an access key..."
CREDS_JSON=$(aws iam create-access-key --user-name "$USER_NAME")
ACCESS_KEY_ID=$(echo "$CREDS_JSON" | grep -o '"AccessKeyId": *"[^"]*"' | cut -d'"' -f4)
SECRET_ACCESS_KEY=$(echo "$CREDS_JSON" | grep -o '"SecretAccessKey": *"[^"]*"' | cut -d'"' -f4)

echo
echo "Done. Set these in Vercel -> Project Settings -> Environment Variables"
echo "(Production scope), then trigger a clean rebuild:"
echo
echo "  CLOUDWATCH_REGION            = $REGION"
echo "  CLOUDWATCH_LOG_GROUP         = $LOG_GROUP_NAME"
echo "  CLOUDWATCH_ACCESS_KEY_ID     = $ACCESS_KEY_ID"
echo "  CLOUDWATCH_SECRET_ACCESS_KEY = $SECRET_ACCESS_KEY"
echo
echo "(Named CLOUDWATCH_* rather than AWS_* on purpose — Vercel's own Lambda"
echo " runtime sets AWS_REGION/AWS_ACCESS_KEY_ID/etc. itself, and user-supplied"
echo " values under those names can be ignored or clobbered.)"
