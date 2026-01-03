#!/bin/bash

# Script to upload deployment script to your Kamatera server

SERVER_IP="185.237.97.42"
echo "This script will upload the deployment script to your Kamatera server"
echo "Server IP: $SERVER_IP"
echo ""
echo "You will be prompted for your root password"
echo ""

# Upload the deployment script
scp deploy-kamatera.sh root@$SERVER_IP:/root/deploy.sh

# Make it executable and run it
ssh root@$SERVER_IP "chmod +x /root/deploy.sh && /root/deploy.sh"

echo "Deployment script has been executed on the server!"