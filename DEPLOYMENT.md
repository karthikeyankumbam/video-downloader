# AWS Deployment Guide

This guide explains how to deploy the YouTube Video Downloader to AWS.

## Deployment Options

### Option 1: AWS ECS Fargate (Recommended)

ECS Fargate is a serverless compute engine for containers. This is the easiest option.

#### Prerequisites

1. AWS CLI installed and configured
2. Docker installed locally
3. AWS account with appropriate permissions

#### Steps

1. **Build and push Docker image:**
   ```bash
   chmod +x aws-deploy.sh
   ./aws-deploy.sh
   ```

2. **Create ECS Cluster:**
   ```bash
   aws ecs create-cluster --cluster-name youtube-downloader-cluster --region us-east-1
   ```

3. **Update task definition:**
   - Edit `ecs-task-definition.json`
   - Replace `YOUR_ECR_REPOSITORY_URL` with your actual ECR repository URL

4. **Create VPC and Networking (if needed):**
   ```bash
   # Create VPC, subnets, security groups, etc.
   # Or use existing VPC configuration
   ```

5. **Register task definition:**
   ```bash
   aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json --region us-east-1
   ```

6. **Create ECS Service:**
   ```bash
   aws ecs create-service \
     --cluster youtube-downloader-cluster \
     --service-name youtube-downloader-service \
     --task-definition youtube-downloader \
     --desired-count 1 \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
     --region us-east-1
   ```

7. **Set up Application Load Balancer (ALB):**
   - Create ALB in AWS Console
   - Configure target group to point to ECS service
   - Update security groups to allow traffic

### Option 2: AWS Elastic Beanstalk

Elastic Beanstalk is easier to set up but less flexible.

#### Steps

1. **Install EB CLI:**
   ```bash
   pip install awsebcli
   ```

2. **Initialize Elastic Beanstalk:**
   ```bash
   eb init -p docker youtube-downloader --region us-east-1
   ```

3. **Create and deploy:**
   ```bash
   eb create youtube-downloader-env
   eb deploy
   ```

4. **Open application:**
   ```bash
   eb open
   ```

### Option 3: EC2 Instance

Run on a traditional EC2 instance.

#### Steps

1. **Launch EC2 instance:**
   - Use Ubuntu or Amazon Linux AMI
   - Minimum: t3.medium (2 vCPU, 4 GB RAM)
   - Recommended: t3.large or larger

2. **SSH into instance:**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```

3. **Install dependencies:**
   ```bash
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Install Python and yt-dlp
   sudo apt-get update
   sudo apt-get install -y python3 python3-pip
   pip3 install yt-dlp

   # Install Docker (optional, if using Docker)
   # Or install PM2 for process management
   sudo npm install -g pm2
   ```

4. **Deploy application:**
   ```bash
   git clone your-repo-url
   cd video
   npm install --production
   ```

5. **Configure environment:**
   ```bash
   export PORT=3000
   export NODE_ENV=production
   ```

6. **Start application:**
   ```bash
   # Using PM2
   pm2 start server.js --name youtube-downloader
   pm2 save
   pm2 startup
   ```

7. **Configure security group:**
   - Allow inbound traffic on port 3000 (or your chosen port)
   - Or set up Nginx as reverse proxy

### Option 4: AWS Lambda + API Gateway (Not Recommended)

Note: Lambda has limitations (15-minute timeout, large file handling), so this is not ideal for video downloads.

## Environment Variables

Set these in your deployment environment:

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Set to `production`

## Security Considerations

1. **CORS Configuration:**
   - Update CORS settings in `server.js` if needed
   - Only allow specific origins in production

2. **Rate Limiting:**
   - Consider adding rate limiting middleware
   - Prevent abuse of the download service

3. **HTTPS:**
   - Always use HTTPS in production
   - Use AWS Certificate Manager for SSL certificates

4. **Security Groups:**
   - Restrict access to necessary ports only
   - Use VPC for private networking

## Monitoring

1. **CloudWatch Logs:**
   - Configure log groups for ECS tasks
   - Monitor application logs

2. **CloudWatch Metrics:**
   - Monitor CPU, memory usage
   - Set up alarms for errors

## Cost Optimization

- Use reserved instances for EC2 (if using EC2)
- Use spot instances for development
- Monitor ECS task usage
- Set up auto-scaling based on demand

## Troubleshooting

### Docker build fails
- Check Dockerfile syntax
- Verify all dependencies are listed

### ECS tasks not starting
- Check task definition JSON
- Verify ECR image exists
- Check security group and subnet configuration

### Application errors
- Check CloudWatch logs
- Verify yt-dlp is installed
- Check environment variables

## Support

For issues with deployment, check:
- AWS documentation
- Docker logs
- CloudWatch logs
- Application logs

