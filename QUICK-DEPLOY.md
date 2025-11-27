# Quick Deployment Guide: EC2 + GitHub

## 🚀 Fastest Way to Deploy

### Step 1: Push to GitHub

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit"

# Add your GitHub repository
git remote add origin https://github.com/your-username/your-repo.git
git branch -M main
git push -u origin main
```

### Step 2: Launch EC2 Instance

1. Go to AWS Console → EC2
2. Launch Instance:
   - **AMI:** Ubuntu 22.04 LTS
   - **Instance Type:** t3.medium (or larger)
   - **Key Pair:** Create or use existing
   - **Security Group:** Allow SSH (22) and HTTP (3000)
   - **User Data:** Paste content from `ec2-user-data.sh` (optional)

### Step 3: Set Up GitHub Secrets (for Auto-Deploy)

1. Go to GitHub Repository → Settings → Secrets and variables → Actions
2. Add these secrets:
   - `EC2_HOST`: Your EC2 public IP or DNS
   - `EC2_USER`: `ubuntu` (or your EC2 user)
   - `EC2_SSH_KEY`: Content of your `.pem` file (full private key)

### Step 4: Deploy (Choose One)

#### Option A: Automatic (GitHub Actions)

Just push to `main` branch:
```bash
git push origin main
```

GitHub Actions will automatically deploy!

#### Option B: Manual Script

```bash
export EC2_HOST=your-ec2-ip
export EC2_USER=ubuntu
export EC2_SSH_KEY=~/.ssh/your-key.pem

./deploy-ec2.sh
```

#### Option C: Manual SSH

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# On EC2, run:
sudo mkdir -p /var/www/youtube-downloader
sudo chown -R ubuntu:ubuntu /var/www/youtube-downloader
cd /var/www/youtube-downloader
git clone https://github.com/your-username/your-repo.git .
npm ci --production
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Step 5: Access Your App

Open in browser:
```
http://your-ec2-ip:3000
```

## 📝 Important Files

- `ec2-setup.md` - Detailed deployment guide
- `deploy-ec2.sh` - Automated deployment script
- `.github/workflows/deploy.yml` - GitHub Actions CI/CD
- `ecosystem.config.js` - PM2 configuration
- `ec2-user-data.sh` - EC2 initialization script

## 🔧 Post-Deployment

### Check Status
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip 'pm2 status'
```

### View Logs
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip 'pm2 logs youtube-downloader'
```

### Restart App
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip 'pm2 restart youtube-downloader'
```

## 🎯 Next Steps

1. Set up domain name (optional)
2. Configure Nginx reverse proxy (see `ec2-setup.md`)
3. Set up SSL certificate
4. Configure monitoring

## ❓ Troubleshooting

See `ec2-setup.md` for detailed troubleshooting guide.

