# Nginx Configuration Security Setup

## Overview

This nginx configuration has been updated to address security concerns by separating development and production configurations.

## Security Improvements

### ✅ Removed Development Server from Production

- The `dev.localhost` HTTP server block is no longer included by default
- Production deployments now use HTTPS-only configuration
- Development server is conditionally included via environment variables

### ✅ Environment-Based Configuration

- Production: HTTPS only with full security headers
- Development: Includes HTTP dev server with warnings

### ✅ Proper SSL Configuration

- HTTPS server block is always enabled in production
- SSL certificates must be properly configured before deployment
- Full set of security headers enabled

## Usage

### Production Deployment (Recommended)

```bash
# 1. Configure SSL certificates
sudo cp your-certificate.pem /etc/ssl/certs/
sudo cp your-private-key.pem /etc/ssl/private/
sudo chmod 600 /etc/ssl/private/your-private-key.pem

# 2. Update certificate paths in nginx.conf
# Edit /etc/nginx/nginx.conf and update:
# ssl_certificate /etc/ssl/certs/your-certificate.pem;
# ssl_certificate_key /etc/ssl/private/your-private-key.pem;

# 3. Test configuration
sudo nginx -t

# 4. Reload nginx
sudo nginx -s reload
```

### Development Deployment

```bash
# 1. Set environment variable
export NGINX_ENV=development

# 2. Run setup script
sudo ./nginx/setup-nginx.sh

# 3. Or manually copy dev config
sudo cp ./nginx/dev-server.conf /etc/nginx/conf.d/

# 4. Test configuration
sudo nginx -t

# 5. Reload nginx
sudo nginx -s reload
```

## Security Warnings

### 🚨 Development Server Risks

- The development server (`dev.localhost`) uses HTTP only
- Reduced security headers compared to production
- Should NEVER be exposed to the internet
- Only use for local development

### 🔒 Production Requirements

- Always use HTTPS in production
- Configure valid SSL certificates
- Keep SSL certificates updated
- Monitor certificate expiration

## Configuration Files

- `nginx.conf` - Main nginx configuration (production-ready)
- `dev-server.conf` - Development server configuration (HTTP only)
- `setup-nginx.sh` - Setup script for environment-based configuration

## Testing

### Test Production Configuration

```bash
curl -I https://localhost/
# Should return 200 OK with security headers
```

### Test Development Configuration

```bash
curl -I http://dev.localhost/dev-warning
# Should return development warning
```

## Deployment Checklist

- [ ] SSL certificates configured and valid
- [ ] Certificate paths updated in nginx.conf
- [ ] nginx configuration tested (`nginx -t`)
- [ ] nginx reloaded successfully
- [ ] HTTPS accessible and working
- [ ] Security headers present in responses
- [ ] Development server NOT accessible in production

## Troubleshooting

### Common Issues

1. **SSL Certificate Errors**
   - Check certificate file permissions (600 for private key)
   - Verify certificate paths in nginx.conf
   - Ensure certificates are not expired

2. **Configuration Syntax Errors**
   - Run `sudo nginx -t` to check syntax
   - Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`

3. **Permission Denied**
   - Ensure nginx can read certificate files
   - Check file ownership and permissions

## Security Best Practices

- Regularly update SSL certificates before expiration
- Use strong SSL ciphers and protocols
- Monitor nginx access and error logs
- Keep nginx updated with security patches
- Use HTTPS-only in production environments
- Implement proper firewall rules

## Emergency Contacts

If you encounter issues with the nginx configuration:

1. Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`
2. Test configuration syntax: `sudo nginx -t`
3. Temporarily revert to HTTP-only if SSL issues persist
4. Contact your DevOps team for assistance
