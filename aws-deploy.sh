#!/bin/bash

# AWS Deployment Script for YouTube Video Downloader
# This script helps deploy the application to AWS ECS Fargate

set -e

echo "🚀 Starting AWS Deployment..."

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPOSITORY="youtube-downloader"
ECS_CLUSTER="youtube-downloader-cluster"
ECS_SERVICE="youtube-downloader-service"
ECS_TASK_FAMILY="youtube-downloader"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Configuration:${NC}"
echo "  AWS Region: $AWS_REGION"
echo "  AWS Account: $AWS_ACCOUNT_ID"
echo "  ECR Repository: $ECR_REPOSITORY"
echo ""

# Step 1: Create ECR repository if it doesn't exist
echo -e "${YELLOW}Step 1: Checking ECR repository...${NC}"
if ! aws ecr describe-repositories --repository-names $ECR_REPOSITORY --region $AWS_REGION &> /dev/null; then
    echo "Creating ECR repository..."
    aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION
else
    echo "ECR repository already exists."
fi

# Step 2: Login to ECR
echo -e "${YELLOW}Step 2: Logging into ECR...${NC}"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Step 3: Build Docker image
echo -e "${YELLOW}Step 3: Building Docker image...${NC}"
docker build -t $ECR_REPOSITORY:latest .

# Step 4: Tag image
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest"
echo -e "${YELLOW}Step 4: Tagging image...${NC}"
docker tag $ECR_REPOSITORY:latest $ECR_URI

# Step 5: Push to ECR
echo -e "${YELLOW}Step 5: Pushing image to ECR...${NC}"
docker push $ECR_URI

echo -e "${GREEN}✅ Image pushed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Create ECS cluster (if not exists):"
echo "   aws ecs create-cluster --cluster-name $ECS_CLUSTER --region $AWS_REGION"
echo ""
echo "2. Update task definition with ECR URI: $ECR_URI"
echo ""
echo "3. Register task definition:"
echo "   aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json --region $AWS_REGION"
echo ""
echo "4. Create/update ECS service:"
echo "   aws ecs create-service --cluster $ECS_CLUSTER --service-name $ECS_SERVICE --task-definition $ECS_TASK_FAMILY --desired-count 1 --launch-type FARGATE --network-configuration \"awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}\" --region $AWS_REGION"

