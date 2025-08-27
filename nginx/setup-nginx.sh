#!/bin/bash

# Nginx Configuration Setup Script
# This script sets up nginx configuration based on environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration paths
NGINX_CONF_DIR="/etc/nginx/conf.d"
DEV_SERVER_CONF="/etc/nginx/conf.d/dev-server.conf"
MAIN_CONF="/etc/nginx/nginx.conf"

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root or with sudo"
   exit 1
fi

# Create conf.d directory if it doesn't exist
mkdir -p "$NGINX_CONF_DIR"

# Function to setup production configuration (HTTPS only)
setup_production() {
    log_info "Setting up production configuration (HTTPS only)..."

    # Remove development server config if it exists
    if [[ -f "$DEV_SERVER_CONF" ]]; then
        rm -f "$DEV_SERVER_CONF"
        log_info "Removed development server configuration"
    fi

    # Ensure HTTPS server is enabled in main config
    if ! grep -q "listen 443 ssl" "$MAIN_CONF"; then
        log_error "HTTPS server block not found in main configuration"
        log_error "Please ensure SSL certificates are properly configured"
        exit 1
    fi

    log_info "Production configuration ready"
}

# Function to setup development configuration (includes dev server)
setup_development() {
    log_info "Setting up development configuration (includes dev server)..."

    # Copy development server config
    cp "/usr/share/nginx/html/dev-server.conf" "$DEV_SERVER_CONF"
    log_warn "WARNING: Development server enabled with reduced security!"
    log_warn "This should NEVER be used in production environments"

    # Add development warning to main page
    log_info "Development configuration ready"
}

# Main logic
case "${NGINX_ENV:-production}" in
    "development"|"dev")
        log_info "Environment: DEVELOPMENT"
        setup_development
        ;;
    "production"|"prod")
        log_info "Environment: PRODUCTION"
        setup_production
        ;;
    *)
        log_warn "Unknown environment: $NGINX_ENV"
        log_warn "Defaulting to production configuration"
        setup_production
        ;;
esac

# Test nginx configuration
log_info "Testing nginx configuration..."
if nginx -t; then
    log_info "Nginx configuration is valid"
    log_info "Run 'sudo nginx -s reload' to apply changes"
else
    log_error "Nginx configuration has errors"
    exit 1
fi

log_info "Nginx configuration setup complete!"
