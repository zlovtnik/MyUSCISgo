#!/bin/bash

# Development Environment Setup Script
# This script sets up the development environment for the WASM app

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Go if not present
install_go() {
    if ! command_exists go; then
        log_step "Installing Go 1.25+..."

        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux installation
            wget -q https://go.dev/dl/go1.25.0.linux-amd64.tar.gz
            sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go1.25.0.linux-amd64.tar.gz
            export PATH=$PATH:/usr/local/go/bin
            echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
            rm go1.25.0.linux-amd64.tar.gz
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS installation
            brew install go
        else
            log_error "Unsupported OS for automatic Go installation. Please install Go 1.25+ manually."
            exit 1
        fi

        log_info "Go installed successfully."
    else
        log_info "Go is already installed: $(go version)"
    fi
}

# Install Node.js if not present
install_node() {
    if ! command_exists node; then
        log_step "Installing Node.js 18+..."

        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux installation
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS installation
            brew install node
        else
            log_error "Unsupported OS for automatic Node.js installation. Please install Node.js 18+ manually."
            exit 1
        fi

        log_info "Node.js installed successfully."
    else
        log_info "Node.js is already installed: $(node --version)"
    fi
}

# Install Docker if not present
install_docker() {
    if ! command_exists docker; then
        log_step "Installing Docker..."

        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux installation
            curl -fsSL https://get.docker.com -o get-docker.sh
            sudo sh get-docker.sh
            sudo usermod -aG docker $USER
            rm get-docker.sh
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS installation
            brew install --cask docker
        else
            log_error "Unsupported OS for automatic Docker installation. Please install Docker manually."
            exit 1
        fi

        log_info "Docker installed successfully. You may need to restart your shell."
    else
        log_info "Docker is already installed: $(docker --version)"
    fi
}

# Setup Go environment
setup_go() {
    log_step "Setting up Go environment..."

    cd go

    # Download dependencies
    go mod download

    # Verify WASM support
    if ! go version | grep -q "go1.25"; then
        log_warn "Go version is not 1.25+. Some features may not work correctly."
    fi

    # Test WASM build
    log_info "Testing WASM build..."
    if GOOS=js GOARCH=wasm go build -o /tmp/test.wasm .; then
        log_info "WASM build test successful."
        rm /tmp/test.wasm
    else
        log_error "WASM build test failed."
        exit 1
    fi

    cd ..
}

# Setup frontend environment
setup_frontend() {
    log_step "Setting up frontend environment..."

    cd frontend

    # Install dependencies
    log_info "Installing frontend dependencies..."
    npm install

    # Install Playwright browsers
    log_info "Installing Playwright browsers..."
    npx playwright install

    # Test build
    log_info "Testing frontend build..."
    if npm run build; then
        log_info "Frontend build test successful."
    else
        log_error "Frontend build test failed."
        exit 1
    fi

    cd ..
}

# Setup Docker environment
setup_docker() {
    log_step "Setting up Docker environment..."

    # Build test
    log_info "Testing Docker build..."
    if docker build -t wasm-app-test .; then
        log_info "Docker build test successful."
        docker rmi wasm-app-test >/dev/null 2>&1 || true
    else
        log_error "Docker build test failed."
        exit 1
    fi
}

# Create environment file template
create_env_template() {
    log_step "Creating environment template..."

    if [ ! -f .env ]; then
        cat > .env << EOF
# Environment Configuration Template
# Copy this file and rename it to .env.local for local development

# Application Environment
NODE_ENV=development
VITE_APP_ENV=development

# API Configuration (if needed)
# VITE_API_URL=http://localhost:3001
# VITE_API_TIMEOUT=5000

# Docker Configuration
DOCKER_REGISTRY=ghcr.io
DOCKER_REPO=your-username/your-repo-name
DOCKER_TAG=latest

# Deployment Configuration
# SERVER=user@your-server.com
# DOCKER_TOKEN=your-docker-registry-token
# DOCKER_USER=your-docker-username

# SSL Configuration (for production)
# SSL_CERT_PATH=/etc/ssl/certs/
# SSL_KEY_PATH=/etc/ssl/private/

# Monitoring (optional)
# SENTRY_DSN=your-sentry-dsn
# PROMETHEUS_PORT=9090
EOF
        log_info "Created .env template file."
    else
        log_info ".env file already exists."
    fi
}

# Run initial tests
run_initial_tests() {
    log_step "Running initial tests..."

    # Go tests
    log_info "Running Go tests..."
    cd go
    if go test ./... -v; then
        log_info "Go tests passed."
    else
        log_warn "Some Go tests failed. Check the output above."
    fi
    cd ..

    # Frontend tests
    log_info "Running frontend tests..."
    cd frontend
    if npm run test:run; then
        log_info "Frontend tests passed."
    else
        log_warn "Some frontend tests failed. Check the output above."
    fi
    cd ..
}

# Show next steps
show_next_steps() {
    log_info "Development environment setup completed!"
    echo
    echo "Next steps:"
    echo "1. Copy .env to .env.local and configure your environment variables"
    echo "2. Start development server: cd frontend && npm run dev"
    echo "3. Open http://localhost:5173 in your browser"
    echo "4. Run tests: ./scripts/deploy.sh test"
    echo "5. Build for production: ./scripts/deploy.sh build"
    echo "6. Deploy locally: ./scripts/deploy.sh deploy-local"
    echo
    echo "Available commands:"
    echo "  ./scripts/deploy.sh help    - Show all deployment options"
    echo "  ./scripts/deploy.sh test    - Run all tests"
    echo "  ./scripts/deploy.sh all     - Build, test, and deploy locally"
    echo
    echo "For production deployment:"
    echo "  1. Set up your Docker registry credentials"
    echo "  2. Configure your server for deployment"
    echo "  3. Run: SERVER=user@server.com ./scripts/deploy.sh deploy-remote"
}

# Main setup function
main() {
    log_info "Starting WASM App development environment setup..."
    echo

    # Check OS
    log_info "Detected OS: $OSTYPE"

    # Install dependencies
    install_go
    install_node
    install_docker

    # Setup environments
    setup_go
    setup_frontend
    setup_docker

    # Create configuration
    create_env_template

    # Run tests
    run_initial_tests

    # Show completion message
    show_next_steps
}

# Run main function
main "$@"
