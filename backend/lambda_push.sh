#!/bin/bash
set -eo pipefail

# Static IAM user credentials, not the default profile's SSO-style session
# that expires - matches the profile main.tf already uses for Terraform.
export AWS_PROFILE=meso-deploy

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1
REGISTRY=$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com
REPO=meso-market-backend

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $REGISTRY

OLD_DIGEST=$(aws ecr describe-images --repository-name $REPO --image-ids imageTag=latest \
  --region $REGION --query 'imageDetails[0].imageDigest' --output text 2>/dev/null || echo "none")

docker build --platform linux/amd64 -t $REGISTRY/$REPO:latest .
docker push $REGISTRY/$REPO:latest

NEW_DIGEST=$(aws ecr describe-images --repository-name $REPO --image-ids imageTag=latest \
  --region $REGION --query 'imageDetails[0].imageDigest' --output text)

# A build that silently reuses stale content (e.g. a bad cache) still "succeeds"
# here without this check, redeploying nothing while reporting no error.
if [ "$OLD_DIGEST" = "$NEW_DIGEST" ]; then
  echo "ERROR: pushed image digest ($NEW_DIGEST) is unchanged from before the build - nothing new was deployed." >&2
  exit 1
fi
echo "New image digest: $NEW_DIGEST (was: $OLD_DIGEST)"

# --query limits output to non-secret fields - the full response includes
# Environment.Variables (every secret this Lambda holds) in plaintext.
aws lambda update-function-code --function-name meso-market-backend \
  --image-uri $REGISTRY/$REPO:latest --region $REGION \
  --query '{LastUpdateStatus: LastUpdateStatus, CodeSha256: CodeSha256}'