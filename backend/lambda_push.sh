ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1
REGISTRY=$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $REGISTRY
docker build -t meso-market-tracker/backend .
docker tag meso-market-tracker/backend:latest $REGISTRY/meso-market-tracker/backend:latest
docker push $REGISTRY/meso-market-tracker/backend:latest