#!/usr/bin/env bash
# Build and push Nova AI Docker image to AWS ECR.
# Usage: bash scripts/deploy-aws.sh <aws-account-id> <region> <ecr-repo-name>
# Example: bash scripts/deploy-aws.sh 123456789012 us-east-1 nova-ai
set -euo pipefail

ACCOUNT_ID="${1:?aws-account-id required}"
REGION="${2:?region required}"
REPO="${3:?ecr-repo-name required}"
TAG="${4:-latest}"

REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
IMAGE_URI="${REGISTRY}/${REPO}:${TAG}"

echo "→ Ensuring ECR repository exists..."
aws ecr describe-repositories --repository-names "$REPO" --region "$REGION" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$REPO" --region "$REGION" >/dev/null

echo "→ Authenticating Docker with ECR..."
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

echo "→ Building image: $IMAGE_URI"
docker build --platform linux/amd64 -t "$IMAGE_URI" .

echo "→ Pushing to ECR..."
docker push "$IMAGE_URI"

echo ""
echo "✓ Image pushed: $IMAGE_URI"
echo ""
echo "Next steps:"
echo "  • App Runner: console → Create service → Container registry → ${IMAGE_URI}"
echo "  • ECS Fargate: register a task definition referencing ${IMAGE_URI}, port 3000"
echo "  • Lightsail:  aws lightsail push-container-image --service-name nova-ai --label nova --image ${IMAGE_URI}"
