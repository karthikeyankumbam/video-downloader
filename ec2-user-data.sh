#!/bin/bash
# EC2 User Data Script
# This script runs when the EC2 instance first starts

set -e

# Update system
apt-get update -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install Python and yt-dlp
apt-get install -y python3 python3-pip
pip3 install yt-dlp

# Install PM2
npm install -g pm2

# Install Git
apt-get install -y git

# Install Nginx (optional, for reverse proxy)
apt-get install -y nginx

# Create app directory
mkdir -p /var/www/youtube-downloader
chown -R ubuntu:ubuntu /var/www/youtube-downloader

# Configure firewall
ufw allow 22/tcp
ufw allow 3000/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Log completion
echo "EC2 setup completed at $(date)" >> /var/log/user-data.log

