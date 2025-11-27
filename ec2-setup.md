# EC2 Deployment Guide

This guide explains how to deploy the YouTube Video Downloader to an EC2 instance using GitHub.

## Prerequisites

1. **AWS EC2 Instance:**
   - Launch an Ubuntu 20.04+ or Amazon Linux 2 instance
   - Minimum: t3.medium (2 vCPU, 4 GB RAM)
   - Recommended: t3.large or larger
   - Security group should allow:
     - SSH (port 22) from your IP
     - HTTP (port 3000) from anywhere (or your load balancer)

2. **GitHub Repository:**
   - Push your code to GitHub
   - Have SSH access to the repository (or use HTTPS with token)

3. **Local Machine:**
   - SSH key pair for EC2 access
   - AWS CLI (optional, for easier management)

## Option 1: Manual Deployment

### Step 1: Set Up EC2 Instance

1. **Launch EC2 Instance:**
   ```bash
   # Via AWS Console or CLI
   aws ec2 run-instances \
     --image-id ami-0c55b159cbfafe1f0 \
     --instance-type t3.medium \
     --key-name your-key-pair \
     --security-group-ids sg-xxxxxxxxx \
     --user-data file://ec2-user-data.sh
   ```

2. **Connect to Instance:**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```

3. **Run Setup Script:**
   ```bash
   # On EC2 instance
   curl -fsSL https://raw.githubusercontent.com/your-repo/setup.sh | bash
   # Or manually install dependencies (see below)
   ```

### Step 2: Manual Setup on EC2

SSH into your EC2 instance and run:

```bash
# Update system
sudo apt-get update

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python and yt-dlp
sudo apt-get install -y python3 python3-pip
sudo pip3 install yt-dlp

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Git
sudo apt-get install -y git

# Create app directory
sudo mkdir -p /var/www/youtube-downloader
sudo chown -R ubuntu:ubuntu /var/www/youtube-downloader
cd /var/www/youtube-downloader

# Clone your repository
git clone https://github.com/your-username/your-repo.git .

# Install dependencies
npm ci --production

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
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
EOF

# Create logs directory
mkdir -p logs

# Start application
pm2 start ecosystem.config.js
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Follow the instructions it provides
```

### Step 3: Configure Firewall

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow application port
sudo ufw allow 3000/tcp

# Enable firewall
sudo ufw --force enable
sudo ufw status
```

### Step 4: Configure Security Group

In AWS Console:
1. Go to EC2 → Security Groups
2. Select your instance's security group
3. Add inbound rules:
   - Type: Custom TCP, Port: 3000, Source: 0.0.0.0/0 (or your load balancer)
   - Type: SSH, Port: 22, Source: Your IP

## Option 2: Automated Deployment Script

### Step 1: Configure Environment Variables

```bash
export EC2_HOST=your-ec2-ip-or-dns
export EC2_USER=ubuntu
export EC2_SSH_KEY=~/.ssh/your-key.pem
```

### Step 2: Run Deployment Script

```bash
chmod +x deploy-ec2.sh
./deploy-ec2.sh
```

The script will:
- Install all dependencies
- Clone your GitHub repository
- Install Node.js dependencies
- Set up PM2 process manager
- Start the application
- Configure firewall

## Option 3: GitHub Actions CI/CD

### Step 1: Set Up GitHub Secrets

In your GitHub repository, go to Settings → Secrets and add:

- `EC2_HOST`: Your EC2 instance IP or DNS
- `EC2_USER`: SSH user (usually `ubuntu`)
- `EC2_SSH_KEY`: Your private SSH key (entire content of `.pem` file)

### Step 2: Set Up EC2 for GitHub Actions

On your EC2 instance, create a deployment user (optional, or use existing user):

```bash
# On EC2
sudo mkdir -p /var/www/youtube-downloader
sudo chown -R ubuntu:ubuntu /var/www/youtube-downloader
cd /var/www/youtube-downloader

# Initialize git repository
git init
git remote add origin https://github.com/your-username/your-repo.git
```

### Step 3: Push to GitHub

When you push to `main` or `master` branch, GitHub Actions will automatically:
- Deploy to EC2
- Install dependencies
- Restart the application

```bash
git add .
git commit -m "Setup deployment"
git push origin main
```

## Option 4: Using Nginx as Reverse Proxy

For production, use Nginx as a reverse proxy:

### Install Nginx

```bash
sudo apt-get install -y nginx
```

### Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/youtube-downloader
```

Add configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeout for video downloads
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }
}
```

### Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/youtube-downloader /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Managing the Application

### PM2 Commands

```bash
# Check status
pm2 status

# View logs
pm2 logs youtube-downloader

# Restart
pm2 restart youtube-downloader

# Stop
pm2 stop youtube-downloader

# Monitor
pm2 monit
```

### Updating the Application

```bash
cd /var/www/youtube-downloader
git pull origin main
npm ci --production
pm2 restart youtube-downloader
```

Or if using GitHub Actions, just push to GitHub!

## Monitoring and Logs

### View Application Logs

```bash
# PM2 logs
pm2 logs youtube-downloader

# Application logs
tail -f /var/www/youtube-downloader/logs/out.log
tail -f /var/www/youtube-downloader/logs/err.log
```

### Monitor Resources

```bash
# System resources
htop

# PM2 monitoring
pm2 monit

# Check application health
curl http://localhost:3000/api/health
```

## Troubleshooting

### Application not starting
```bash
# Check PM2 logs
pm2 logs youtube-downloader --lines 50

# Check if port is in use
sudo netstat -tulpn | grep 3000

# Check Node.js version
node --version
```

### yt-dlp not found
```bash
# Check if installed
which yt-dlp
yt-dlp --version

# Reinstall if needed
sudo pip3 install --upgrade yt-dlp
```

### Port 3000 not accessible
```bash
# Check firewall
sudo ufw status

# Check security group in AWS Console
# Ensure port 3000 is open
```

## Security Recommendations

1. **Use HTTPS:**
   - Set up SSL certificate (Let's Encrypt)
   - Configure Nginx for HTTPS

2. **Restrict Access:**
   - Only allow necessary ports in security group
   - Use VPC for private networking
   - Consider using a load balancer

3. **Keep Updated:**
   - Regularly update system packages
   - Keep Node.js and dependencies updated
   - Update yt-dlp regularly: `sudo pip3 install --upgrade yt-dlp`

4. **Monitor:**
   - Set up CloudWatch alarms
   - Monitor application logs
   - Set up error alerts

## Cost Optimization

- Use reserved instances for long-term use
- Use spot instances for development
- Monitor instance usage
- Set up auto-scaling if needed

## Next Steps

After deployment:
1. Test the application: `http://your-ec2-ip:3000`
2. Set up a domain name (optional)
3. Configure SSL certificate
4. Set up monitoring and alerts
5. Configure backup strategy

