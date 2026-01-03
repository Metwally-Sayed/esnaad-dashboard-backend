#!/bin/bash

# Deployment script for Kamatera VPS
# This script installs Docker and deploys the Esnaad Backend

set -e

echo "========================================="
echo "Esnaad Backend Deployment Script"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Update system
echo -e "${YELLOW}Step 1: Updating system packages...${NC}"
apt update && apt upgrade -y

# Step 2: Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Step 2: Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl start docker
    systemctl enable docker
    usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}Docker installed successfully!${NC}"
else
    echo -e "${GREEN}Docker is already installed${NC}"
fi

# Step 3: Create app directory
echo -e "${YELLOW}Step 3: Creating app directory...${NC}"
mkdir -p /root/esnaad-backend
cd /root/esnaad-backend

# Step 4: Create environment file
echo -e "${YELLOW}Step 4: Creating environment configuration...${NC}"
cat > .env << 'EOF'
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://neondb_owner:npg_nufspbcK1I2j@ep-bitter-king-agr4hktc-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=tib6aGUuHbqay11AWvfknZE/vIx8oNSBRPlYYuUfh30=
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=XBMY7Vh3TVp0LPDKDqRIDzLg4MYhXhSB8TkLpu+AMRg=
JWT_REFRESH_EXPIRES_IN=30d
OTP_EXPIRES_IN_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_MAX_RESENDS=3
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=*
AWS_REGION=eu-central-1
AWS_S3_BUCKET=esnaad-dashboard
EOF

echo -e "${GREEN}Environment file created${NC}"

# Step 5: Stop and remove existing container if exists
echo -e "${YELLOW}Step 5: Cleaning up old containers...${NC}"
docker stop esnaad-backend 2>/dev/null || true
docker rm esnaad-backend 2>/dev/null || true

# Step 6: Pull latest Docker image
echo -e "${YELLOW}Step 6: Pulling Docker image from Docker Hub...${NC}"
docker pull metwallysayed/esnaad-backend:latest

# Step 7: Run Docker container
echo -e "${YELLOW}Step 7: Starting Docker container...${NC}"
docker run -d \
  --name esnaad-backend \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file .env \
  metwallysayed/esnaad-backend:latest

# Step 8: Install Nginx if not installed
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}Step 8: Installing Nginx...${NC}"
    apt install nginx -y
    systemctl enable nginx
else
    echo -e "${GREEN}Nginx is already installed${NC}"
fi

# Step 9: Configure Nginx
echo -e "${YELLOW}Step 9: Configuring Nginx...${NC}"
cat > /etc/nginx/sites-available/esnaad-backend << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Enable site and remove default
ln -sf /etc/nginx/sites-available/esnaad-backend /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
nginx -t
systemctl restart nginx

# Step 10: Configure firewall
echo -e "${YELLOW}Step 10: Configuring firewall...${NC}"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8080/tcp
ufw --force enable

# Step 11: Check container status
echo -e "${YELLOW}Step 11: Checking deployment status...${NC}"
sleep 5

if docker ps | grep esnaad-backend > /dev/null; then
    echo -e "${GREEN}✓ Docker container is running${NC}"
    docker logs --tail 20 esnaad-backend
else
    echo -e "${RED}✗ Container failed to start${NC}"
    docker logs esnaad-backend
    exit 1
fi

# Step 12: Test the application
echo -e "${YELLOW}Step 12: Testing the application...${NC}"
sleep 3

if curl -s http://localhost:8080/health > /dev/null; then
    echo -e "${GREEN}✓ Application is responding on port 8080${NC}"
else
    echo -e "${RED}✗ Application health check failed${NC}"
fi

if curl -s http://localhost/health > /dev/null; then
    echo -e "${GREEN}✓ Nginx proxy is working on port 80${NC}"
else
    echo -e "${RED}✗ Nginx proxy is not working${NC}"
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Your backend is now accessible at:"
echo "  http://185.237.97.42"
echo "  http://185.237.97.42/health"
echo ""
echo "Useful commands:"
echo "  docker logs esnaad-backend    # View logs"
echo "  docker restart esnaad-backend # Restart container"
echo "  docker ps                     # Check status"
echo ""
echo -e "${GREEN}Done!${NC}"