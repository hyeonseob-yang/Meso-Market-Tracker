#!/usr/bin/env bash
#
# One-time bootstrap: create the `meso-deploy` IAM user that Terraform runs as.
#
# Run this ONCE, with your root/admin AWS CLI login active. It:
#   1. bridges the CLI's resolved credentials into env vars (Terraform's SDK
#      can't read the `login` credential provider that `aws` uses here)
#   2. creates an IAM user + attaches the managed policies this stack needs
#   3. mints an access key and writes it to the `meso-deploy` CLI profile
#
# Afterwards: `export AWS_PROFILE=meso-deploy` and use Terraform normally.
# This script is safe to re-run: existing user / already-attached policies are
# ignored, but step 3 always creates a NEW access key (IAM allows max 2 per
# user — delete an old one if it fails).

set -euo pipefail

USER_NAME=meso-deploy
PROFILE=meso-deploy
REGION=us-east-1
POLICIES=(
  AmazonEC2ContainerRegistryFullAccess
  AWSLambda_FullAccess
  AmazonAPIGatewayAdministrator
  IAMFullAccess
  CloudWatchLogsFullAccess
)

echo ">> Bridging current CLI credentials into this shell..."
eval "$(aws configure export-credentials --format env)"
aws sts get-caller-identity

echo ">> Creating IAM user '$USER_NAME' (ignored if it already exists)..."
aws iam create-user --user-name "$USER_NAME" 2>/dev/null || echo "   user already exists"

echo ">> Attaching managed policies..."
for p in "${POLICIES[@]}"; do
  aws iam attach-user-policy \
    --user-name "$USER_NAME" \
    --policy-arn "arn:aws:iam::aws:policy/$p"
  echo "   + $p"
done

echo ">> Creating an access key..."
CREDS_JSON=$(aws iam create-access-key --user-name "$USER_NAME")
ACCESS_KEY_ID=$(echo "$CREDS_JSON" | grep -o '"AccessKeyId": *"[^"]*"' | cut -d'"' -f4)
SECRET_ACCESS_KEY=$(echo "$CREDS_JSON" | grep -o '"SecretAccessKey": *"[^"]*"' | cut -d'"' -f4)

echo ">> Writing the '$PROFILE' CLI profile..."
aws configure set aws_access_key_id     "$ACCESS_KEY_ID"     --profile "$PROFILE"
aws configure set aws_secret_access_key "$SECRET_ACCESS_KEY" --profile "$PROFILE"
aws configure set region                "$REGION"            --profile "$PROFILE"

echo
echo "Done. New key: $ACCESS_KEY_ID"
echo
echo "Next:"
echo "  export AWS_PROFILE=$PROFILE"
echo "  terraform -chdir=\"\$(dirname \"\$0\")\" init"
echo "  terraform -chdir=\"\$(dirname \"\$0\")\" apply -target=aws_ecr_repository.backend"
