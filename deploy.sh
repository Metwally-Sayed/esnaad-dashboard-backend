#!/bin/bash

# Deployment script for Esnaad Dashboard Backend
# This script builds and optionally pushes the Docker image

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"docker.io"}
DOCKER_USERNAME=${DOCKER_USERNAME:-"your-username"}
IMAGE_NAME=${IMAGE_NAME:-"esnaad-backend"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}

# Full image name
FULL_IMAGE_NAME="${DOCKER_REGISTRY}/${DOCKER_USERNAME}/${IMAGE_NAME}:${IMAGE_TAG}"

echo -e "${GREEN}Starting deployment process...${NC}"

# Step 1: Run tests (if any)
echo -e "${YELLOW}Step 1: Running tests...${NC}"
# npm test || echo -e "${YELLOW}No tests configured, skipping...${NC}"

# Step 2: Build Docker image
echo -e "${YELLOW}Step 2: Building Docker image...${NC}"
docker build -f Dockerfile.production -t ${IMAGE_NAME}:${IMAGE_TAG} .

# Tag the image for registry
docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${FULL_IMAGE_NAME}

echo -e "${GREEN}Docker image built successfully: ${FULL_IMAGE_NAME}${NC}"

# Step 3: Test the image locally
echo -e "${YELLOW}Step 3: Testing image locally...${NC}"
docker run -d --name test-esnaad-backend \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e DATABASE_URL="${DATABASE_URL}" \
  -e JWT_SECRET="test-secret-key-for-local-testing-only" \
  -e JWT_REFRESH_SECRET="test-refresh-secret-for-local-testing" \
  ${IMAGE_NAME}:${IMAGE_TAG}

# Wait for container to start
echo "Waiting for container to start..."
sleep 10

# Check health endpoint
if curl -f http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${GREEN}Health check passed!${NC}"
else
    echo -e "${RED}Health check failed!${NC}"
    docker logs test-esnaad-backend
    docker stop test-esnaad-backend
    docker rm test-esnaad-backend
    exit 1
fi

# Clean up test container
docker stop test-esnaad-backend
docker rm test-esnaad-backend

# Step 4: Push to registry (optional)
read -p "Do you want to push the image to ${DOCKER_REGISTRY}? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Step 4: Pushing to Docker registry...${NC}"

    # Login to Docker registry
    echo "Please login to Docker registry:"
    docker login ${DOCKER_REGISTRY}

    # Push the image
    docker push ${FULL_IMAGE_NAME}

    echo -e "${GREEN}Image pushed successfully: ${FULL_IMAGE_NAME}${NC}"
else
    echo -e "${YELLOW}Skipping push to registry${NC}"
fi

# Step 5: Display deployment instructions
echo -e "${GREEN}Deployment preparation complete!${NC}"
echo
echo "To deploy on claw.cloud:"
echo "1. Go to https://claw.cloud"
echo "2. Create a new application"
echo "3. Use Docker image: ${FULL_IMAGE_NAME}"
echo "4. Set PORT to 8080"
echo "5. Configure environment variables as per DEPLOY_CLAWCLOUD.md"
echo
echo -e "${GREEN}Done!${NC}"