#!/bin/bash

# EC2 Deployment Script
# This script sets up the YouTube Video Downloader on an EC2 instance

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration (update these)
EC2_HOST="${EC2_HOST:-}"
EC2_USER="${EC2_USER:-ubuntu}"
APP_DIR="/var/www/youtube-downloader"
PORT=3000

echo -e "${YELLOW}🚀 EC2 Deployment Script${NC}"
echo ""

# Check if EC2_HOST is provided
if [ -z "$EC2_HOST" ]; then
    echo -e "${RED}Error: EC2_HOST environment variable is not set${NC}"
    echo "Usage: EC2_HOST=your-ec2-ip EC2_USER=ubuntu ./deploy-ec2.sh"
    exit 1
fi

echo -e "${YELLOW}Configuration:${NC}"
echo "  EC2 Host: $EC2_HOST"
echo "  EC2 User: $EC2_USER"
echo "  App Directory: $APP_DIR"
echo ""

# Check if SSH key is available
if [ -z "$EC2_SSH_KEY" ] && [ ! -f ~/.ssh/id_rsa ]; then
    echo -e "${RED}Error: SSH key not found${NC}"
    echo "Please set EC2_SSH_KEY or ensure ~/.ssh/id_rsa exists"
    exit 1
fi

SSH_KEY=${EC2_SSH_KEY:-~/.ssh/id_rsa}
SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST"

echo -e "${YELLOW}Step 1: Testing SSH connection...${NC}"
if ! $SSH_CMD "echo 'Connection successful'" &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to EC2 instance${NC}"
    exit 1
fi
echo -e "${GREEN}✅ SSH connection successful${NC}"
echo ""

echo -e "${YELLOW}Step 2: Installing system dependencies...${NC}"
$SSH_CMD << 'ENDSSH'
    # Update system
    sudo apt-get update -qq
    
    # Install Node.js if not installed
    if ! command -v node &> /dev/null; then
        echo "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Install Python and pip if not installed
    if ! command -v python3 &> /dev/null; then
        echo "Installing Python 3..."
        sudo apt-get install -y python3 python3-pip
    fi
    
    # Install yt-dlp if not installed
    if ! command -v yt-dlp &> /dev/null; then
        echo "Installing yt-dlp..."
        sudo pip3 install yt-dlp
    fi
    
    # Install PM2 if not installed
    if ! command -v pm2 &> /dev/null; then
        echo "Installing PM2..."
        sudo npm install -g pm2
    fi
    
    # Install Git if not installed
    if ! command -v git &> /dev/null; then
        echo "Installing Git..."
        sudo apt-get install -y git
    fi
    
    echo "System dependencies installed successfully!"
ENDSSH
echo -e "${GREEN}✅ System dependencies installed${NC}"
echo ""

echo -e "${YELLOW}Step 3: Creating application directory...${NC}"
$SSH_CMD << ENDSSH
    sudo mkdir -p $APP_DIR
    sudo chown -R $EC2_USER:$EC2_USER $APP_DIR
    cd $APP_DIR
ENDSSH
echo -e "${GREEN}✅ Application directory created${NC}"
echo ""

echo -e "${YELLOW}Step 4: Cloning repository...${NC}"
echo "Please provide your GitHub repository URL:"
read -p "GitHub Repo URL: " GITHUB_REPO

$SSH_CMD << ENDSSH
    cd $APP_DIR
    if [ -d ".git" ]; then
        echo "Repository already exists, pulling latest changes..."
        git pull origin main || git pull origin master
    else
        echo "Cloning repository..."
        git clone $GITHUB_REPO .
    fi
ENDSSH
echo -e "${GREEN}✅ Repository cloned${NC}"
echo ""

echo -e "${YELLOW}Step 5: Installing application dependencies...${NC}"
$SSH_CMD << ENDSSH
    cd $APP_DIR
    npm ci --production
ENDSSH
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

echo -e "${YELLOW}Step 6: Setting up PM2 process...${NC}"
$SSH_CMD << ENDSSH
    cd $APP_DIR
    
    # Create ecosystem file for PM2
    cat > ecosystem.config.js << 'ECOSYSTEM'
    module.exports = {
      apps: [{
        name: 'youtube-downloader',
        script: 'server.js',
        instances: 1,
        exec_mode: 'fork',
        env: {
          NODE_ENV: 'production',
          PORT: 3000
        },
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G'
      }]
    };
ECOSYSTEM
    
    # Create logs directory
    mkdir -p logs
    
    # Stop existing process if running
    pm2 delete youtube-downloader 2>/dev/null || true
    
    # Start application
    pm2 start ecosystem.config.js
    
    # Save PM2 process list
    pm2 save
    
    # Setup PM2 startup script
    sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u $EC2_USER --hp /home/$EC2_USER
ENDSSH
echo -e "${GREEN}✅ PM2 process started${NC}"
echo ""

echo -e "${YELLOW}Step 7: Configuring firewall...${NC}"
$SSH_CMD << 'ENDSSH'
    # Allow port 3000 (adjust if using different port)
    sudo ufw allow 3000/tcp || true
    sudo ufw allow 22/tcp || true
    sudo ufw --force enable || true
    echo "Firewall configured"
ENDSSH
echo -e "${GREEN}✅ Firewall configured${NC}"
echo ""

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${YELLOW}Application is running at:${NC}"
echo "  http://$EC2_HOST:3000"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  Check status: ssh -i $SSH_KEY $EC2_USER@$EC2_HOST 'pm2 status'"
echo "  View logs: ssh -i $SSH_KEY $EC2_USER@$EC2_HOST 'pm2 logs youtube-downloader'"
echo "  Restart: ssh -i $SSH_KEY $EC2_USER@$EC2_HOST 'pm2 restart youtube-downloader'"
echo ""

