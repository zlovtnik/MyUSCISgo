#!/bin/bash

# WASM App Deployment Script
# This script handles building and deploying the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="wasm-app"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io}"
DOCKER_REPO="${DOCKER_REPO:-$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')}"
DOCKER_TAG="${DOCKER_TAG:-$(git rev-parse --short HEAD)}"

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

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    if ! command -v go &> /dev/null; then
        log_error "Go is not installed. Please install Go 1.25+ first."
        exit 1
    fi

    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi

    log_info "All dependencies are installed."
}

# Build Go WASM
build_wasm() {
    log_info "Building Go WASM..."

    cd go
    GOOS=js GOARCH=wasm go build -o ../frontend/public/main.wasm -ldflags="-s -w" -trimpath

    if [ ! -f "../frontend/public/main.wasm" ]; then
        log_error "WASM build failed"
        exit 1
    fi

    log_info "WASM build completed successfully."
    cd ..
}

# Build React frontend
build_frontend() {
    log_info "Building React frontend..."

    cd frontend
    npm ci
    npm run build

    if [ ! -d "dist" ]; then
        log_error "Frontend build failed"
        exit 1
    fi

    log_info "Frontend build completed successfully."
    cd ..
}

# Build Docker image
build_docker() {
    log_info "Building Docker image..."

    docker build -t ${DOCKER_REGISTRY}/${DOCKER_REPO}:${DOCKER_TAG} .
    docker tag ${DOCKER_REGISTRY}/${DOCKER_REPO}:${DOCKER_TAG} ${DOCKER_REGISTRY}/${DOCKER_REPO}:latest

    log_info "Docker image built successfully."
}

# Push Docker image
push_docker() {
    log_info "Pushing Docker image..."

    if [ -z "$DOCKER_TOKEN" ]; then
        log_error "DOCKER_TOKEN environment variable is not set"
        exit 1
    fi

    if [ -z "$DOCKER_USER" ]; then
        log_error "DOCKER_USER environment variable is not set"
        exit 1
    fi

    echo "$DOCKER_TOKEN" | docker login $DOCKER_REGISTRY -u $DOCKER_USER --password-stdin
    docker push ${DOCKER_REGISTRY}/${DOCKER_REPO}:${DOCKER_TAG}
    docker push ${DOCKER_REGISTRY}/${DOCKER_REPO}:latest

    log_info "Docker image pushed successfully."
}

# Deploy locally with docker-compose
deploy_local() {
    log_info "Deploying locally with Docker Compose..."

    docker-compose down
    docker-compose up -d --build

    log_info "Local deployment completed."
    log_info "Application is running at http://localhost"
}

# Deploy to remote server
deploy_remote() {
    local server="$1"

    if [ -z "$server" ]; then
        log_error "Please provide server address for remote deployment"
        exit 1
    fi

    log_info "Deploying to remote server: $server"

    # Build and push Docker image first
    build_docker
    push_docker

    # Deploy using docker-compose on remote server
    log_info "Executing remote deployment commands..."

    # Create a temporary script for remote execution
    cat << 'REMOTE_SCRIPT_EOF' | ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "$server" bash -s
#!/bin/bash
set -euo pipefail

# Trap to ensure cleanup on error
trap 'echo "Remote deployment failed" >&2; exit 1' ERR

cd "/opt/${APP_NAME}"

echo "Pulling latest Docker images..."
docker-compose pull

echo "Stopping existing containers..."
docker-compose down

echo "Starting updated containers..."
docker-compose up -d

echo "Showing recent logs..."
docker-compose logs -f --tail=50

echo "Remote deployment completed successfully"
REMOTE_SCRIPT_EOF

    # Check SSH exit status
    if [ $? -ne 0 ]; then
        log_error "SSH deployment failed with exit code $?"
        exit 1
    fi

    log_info "Remote deployment completed."
}

# Run tests
run_tests() {
    log_info "Running tests..."

    # Go tests
    log_info "Running Go tests..."
    cd go
    go test ./... -v
    cd ..

    # Frontend tests
    log_info "Running frontend tests..."
    cd frontend
    npm test -- --run
    cd ..

    log_info "All tests passed."
}

# Clean build artifacts
clean() {
    log_info "Cleaning build artifacts..."

    rm -rf frontend/dist
    rm -f frontend/public/main.wasm
    rm -f frontend/public/wasm_exec.js
    docker rmi ${DOCKER_REGISTRY}/${DOCKER_REPO}:${DOCKER_TAG} 2>/dev/null || true
    docker rmi ${DOCKER_REGISTRY}/${DOCKER_REPO}:latest 2>/dev/null || true

    log_info "Cleanup completed."
}

# Show help
show_help() {
    cat << EOF
WASM App Deployment Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
  build         Build both WASM and frontend
  docker        Build Docker image
  push          Push Docker image to registry
  deploy-local  Deploy locally with Docker Compose
  deploy-remote Deploy to remote server (requires SERVER env var)
  test          Run all tests
  clean         Clean build artifacts
  all           Build, test, and deploy locally

Environment Variables:
  DOCKER_REGISTRY  Docker registry URL (default: ghcr.io)
  DOCKER_REPO      Docker repository name
  DOCKER_TAG       Docker image tag (default: git commit hash)
  DOCKER_TOKEN     Docker registry token for pushing
  DOCKER_USER      Docker registry username
  SERVER           Remote server address for deployment

Examples:
  $0 build
  $0 test
  $0 docker && $0 push
  $0 deploy-local
  SERVER=user@server.com $0 deploy-remote
  $0 all

EOF
}

# Main script logic
main() {
    case "${1:-help}" in
        "build")
            check_dependencies
            build_wasm
            build_frontend
            ;;
        "docker")
            check_dependencies
            build_wasm
            build_frontend
            build_docker
            ;;
        "push")
            push_docker
            ;;
        "deploy-local")
            check_dependencies
            build_wasm
            build_frontend
            deploy_local
            ;;
        "deploy-remote")
            deploy_remote "$SERVER"
            ;;
        "test")
            check_dependencies
            run_tests
            ;;
        "clean")
            clean
            ;;
        "all")
            check_dependencies
            run_tests
            build_wasm
            build_frontend
            build_docker
            deploy_local
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

main "$@"
