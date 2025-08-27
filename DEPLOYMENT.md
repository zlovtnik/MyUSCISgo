# Deployment Guide

This guide covers deploying the WASM application to various environments including local development, staging, and production.

## Prerequisites

Before deploying, ensure you have the following installed:

- **Go 1.25+** with WASM support
- **Node.js 18+** with npm
- **Docker & Docker Compose**
- **Git**

### Quick Setup

For new developers, run the automated setup script:

```bash
./scripts/setup-dev.sh
```

This will install all dependencies and set up the development environment.

## Environment Configuration

### 1. Environment Variables

Copy the template and configure your environment:

```bash
cp .env .env.local
```

Edit `.env.local` with your specific values:

```bash
# Application Environment
NODE_ENV=production
VITE_APP_ENV=production

# Docker Configuration
DOCKER_REGISTRY=ghcr.io
DOCKER_REPO=your-username/your-repo-name
DOCKER_TAG=latest

# Deployment Configuration
SERVER=user@your-server.com
DOCKER_TOKEN=your-docker-registry-token
DOCKER_USER=your-docker-username
```


### 2. SSL Certificates (Production)

For HTTPS deployment, you'll need SSL certificates. You can:

- **Use Let's Encrypt** (recommended for production):

  ```bash
  # Install certbot
  sudo apt-get install certbot

  # Get certificate
  sudo certbot certonly --webroot -w /usr/share/nginx/html -d yourdomain.com
  ```

- **Use self-signed certificates** (for testing):

  ```bash
  sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/selfsigned.key \
    -out /etc/ssl/certs/selfsigned.crt
  ```


## Deployment Scenarios

### Local Development

#### Option 1: Using Deployment Script

```bash
./scripts/deploy.sh deploy-local
```

#### Option 2: Manual Setup

```bash
# Build the application
./scripts/deploy.sh build

# Start with Docker Compose
docker-compose up -d
```

#### Option 3: Development Mode

```bash
# Start frontend in development mode
cd frontend && npm run dev

# In another terminal, serve built files
cd frontend && npm run preview
```

### Staging Environment

#### Using Docker Registry

```bash
# Build and push to registry
./scripts/deploy.sh docker
./scripts/deploy.sh push

# Deploy to staging server
SERVER=user@staging-server.com ./scripts/deploy.sh deploy-remote
```

#### Manual Staging Deployment

```bash
# On your staging server
git clone https://github.com/your-username/your-repo.git
cd your-repo

# Build and run
./scripts/deploy.sh all
```

### Production Environment

#### Automated Production Deployment

```bash
# Set production environment variables
export NODE_ENV=production
export DOCKER_TAG=$(git rev-parse --short HEAD)

# Deploy to production
SERVER=user@production-server.com ./scripts/deploy.sh deploy-remote
```

#### Manual Production Deployment

```bash
# On your production server
git clone https://github.com/your-username/your-repo.git
cd your-repo

# Use production configuration
cp .env .env.production
# Edit .env.production with production values

# Deploy
./scripts/deploy.sh all
```

## Server Requirements

### Minimum Server Specifications

- **RAM**: 512MB minimum, 1GB recommended
- **CPU**: 1 vCPU minimum, 2 vCPU recommended
- **Storage**: 1GB free space
- **OS**: Linux (Ubuntu 18.04+, CentOS 7+, Debian 9+)

### Required Ports

- **80**: HTTP (redirects to HTTPS in production)
- **443**: HTTPS (production)

### Security Considerations

1. **Firewall Configuration**:

   ```bash
   # Allow only necessary ports
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw allow 22  # SSH
   sudo ufw --force enable
   ```


2. **SSL/TLS Configuration**:
   - Use strong ciphers
   - Enable HSTS
   - Regular certificate renewal

3. **Container Security**:
   - Run as non-root user
   - Use minimal base images
   - Regular security updates

## Monitoring and Maintenance

### Health Checks

The application includes built-in health checks:

```bash
# Check application health
curl http://localhost/health

# Check Docker container health
docker ps
docker-compose ps
```

### Logs

```bash
# View application logs
docker-compose logs -f app

# View nginx logs
docker-compose exec app tail -f /var/log/nginx/access.log
docker-compose exec app tail -f /var/log/nginx/error.log
```

### Updates

```bash
# Update application
git pull origin main
./scripts/deploy.sh all

# Update Docker images
docker-compose pull
docker-compose up -d
```

### Backup

```bash
# Backup Docker volumes (if any)
docker run --rm -v app_data:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz -C /data .
```

## Troubleshooting

### Common Issues

#### WASM Not Loading

```bash
# Check if WASM file exists
ls -la frontend/public/main.wasm

# Check browser console for errors
# Look for CORS or MIME type errors
```

#### Docker Build Failures

```bash
# Clean Docker cache
docker system prune -f

# Rebuild without cache
docker-compose build --no-cache
```

#### Port Already in Use

```bash
# Find process using port
sudo lsof -i :80
sudo lsof -i :443

# Kill process or change port in docker-compose.yml
```

#### SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in /etc/ssl/certs/your-cert.crt -text -noout

# Renew Let's Encrypt certificate
sudo certbot renew
```

### Performance Optimization

#### Nginx Tuning

```nginx
# In nginx.conf, adjust worker processes
worker_processes auto;

# Increase worker connections
events {
    worker_connections 1024;
}

# Enable more caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

#### Docker Optimization

```yaml
# In docker-compose.yml, add resource limits
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## CI/CD Integration

The project includes GitHub Actions for automated testing and deployment:

### Automatic Triggers

- **Push to main/develop**: Runs full test suite
- **Pull requests**: Runs tests and linting
- **Release tags**: Builds and pushes Docker images

### Manual Triggers

```bash
# Trigger deployment manually
gh workflow run deploy.yml -f environment=production
```

### Customizing CI/CD

Edit `.github/workflows/ci-cd.yml` to modify the pipeline:

```yaml
# Add custom steps
- name: Run custom tests
  run: |
    npm run test:e2e
    npm run test:integration
```

## Scaling

### Horizontal Scaling

```bash
# Scale with Docker Compose
docker-compose up -d --scale app=3

# Use load balancer
docker-compose up -d nginx-lb
```

### Vertical Scaling

```yaml
# Increase resources
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
```

## Rollback Strategy

### Quick Rollback

```bash
# Rollback to previous version
docker-compose down
docker pull your-registry/your-app:previous-tag
docker-compose up -d
```

### Blue-Green Deployment

```bash
# Deploy to blue environment
docker-compose -f docker-compose.blue.yml up -d

# Test blue environment
curl http://blue-app/health

# Switch traffic to blue
docker-compose -f docker-compose.green.yml down
```

## Security Checklist

- [ ] SSL/TLS enabled
- [ ] Security headers configured
- [ ] Non-root user for containers
- [ ] Minimal attack surface
- [ ] Regular security updates
- [ ] Secrets management
- [ ] Network segmentation
- [ ] Monitoring and alerting
- [ ] Backup strategy
- [ ] Incident response plan

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review Docker and nginx logs
3. Check GitHub Issues
4. Contact the development team

---

**Last updated**: August 26, 2025
**Version**: 1.0.0
