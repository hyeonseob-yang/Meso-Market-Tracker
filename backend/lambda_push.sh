ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1
REGISTRY=$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com
REPO=meso-market-backend

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $REGISTRY
docker build --platform linux/amd64 -t $REGISTRY/$REPO:latest .
docker push $REGISTRY/$REPO:latest

aws lambda update-function-code --function-name meso-market-backend \
  --image-uri $REGISTRY/$REPO:latest --region $REGION