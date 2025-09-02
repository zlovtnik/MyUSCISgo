# MyUSCISgo - Complete Build System
# Makefile for Go WASM + React Frontend Application

.PHONY: help build build-wasm build-frontend build-prod dev dev-frontend dev-backend test test-unit test-integration test-e2e test-all clean docker-build docker-run docker-stop docker-logs deploy deploy-dev deploy-prod setup setup-dev setup-prod lint format check-deps

# Default target
.DEFAULT_GOAL := help

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

# Project configuration
PROJECT_NAME := MyUSCISgo
DOCKER_REGISTRY := ghcr.io
DOCKER_REPO := zlovtnik/MyUSCISgo
DOCKER_TAG := $(shell git rev-parse --short HEAD 2>/dev/null || echo "latest")
GO_VERSION := 1.25
NODE_VERSION := 20

# Environment variables (only for WASM builds)
# export GOOS := js
# export GOARCH := wasm
# export CGO_ENABLED := 0

# Help target
help: ## Show this help message
	@echo "$(BLUE)$(PROJECT_NAME) - Build System$(NC)"
	@echo ""
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

# Development targets
dev: ## Start development environment (frontend + backend)
	@echo "$(BLUE)🚀 Starting development environment...$(NC)"
	@make -j2 dev-frontend dev-backend

dev-frontend: ## Start frontend development server
	@echo "$(BLUE)🎨 Starting frontend development server...$(NC)"
	@cd frontend && npm run dev

dev-backend: ## Start backend development server
	@echo "$(BLUE)⚙️  Starting backend development server...$(NC)"
	@cd go && go run main.go

# Build targets
build: ## Build all components for development
	@echo "$(BLUE)🔨 Building all components...$(NC)"
	@make build-wasm
	@make build-frontend
	@echo "$(GREEN)✅ All components built successfully!$(NC)"

build-wasm: ## Build Go WASM binary
	@echo "$(BLUE)🔨 Building Go WASM...$(NC)"
	@cd go && go mod tidy
	@cd go && GOOS=js GOARCH=wasm CGO_ENABLED=0 go build -o ../main.wasm -ldflags="-s -w" -trimpath main.go
	@echo "$(GREEN)✅ WASM built successfully!$(NC)"

build-frontend: ## Build React frontend
	@echo "$(BLUE)🎨 Building React frontend...$(NC)"
	@cd frontend && npm install
	@cd frontend && npm run build
	@echo "$(GREEN)✅ Frontend built successfully!$(NC)"

build-prod: ## Build for production
	@echo "$(BLUE)🏗️  Building for production...$(NC)"
	@make clean
	@make build-wasm
	@make build-frontend
	@echo "$(GREEN)✅ Production build completed!$(NC)"

# Testing targets
test: ## Run all tests
	@echo "$(BLUE)🧪 Running all tests...$(NC)"
	@make test-unit
	@make test-integration
	@make test-e2e

test-unit: ## Run unit tests
	@echo "$(BLUE)🧪 Running unit tests...$(NC)"
	@cd frontend && npm run test:unit
	@cd go && go test ./pkg/...

test-integration: ## Run integration tests
	@echo "$(BLUE)🧪 Running integration tests...$(NC)"
	@cd frontend && npm run test:integration
	@cd go && go test -tags=integration ./...

test-e2e: ## Run end-to-end tests
	@echo "$(BLUE)🧪 Running E2E tests...$(NC)"
	@cd frontend && npm run test:e2e

test-all: ## Run comprehensive test suite
	@echo "$(BLUE)🧪 Running comprehensive test suite...$(NC)"
	@cd frontend && npm run test:comprehensive
	@cd go && go test ./...

test-watch: ## Run tests in watch mode
	@echo "$(BLUE)👀 Running tests in watch mode...$(NC)"
	@cd frontend && npm run test:watch

# Docker targets
docker-build: ## Build Docker image
	@echo "$(BLUE)🐳 Building Docker image...$(NC)"
	@docker build -t $(DOCKER_REGISTRY)/$(DOCKER_REPO):$(DOCKER_TAG) .
	@docker tag $(DOCKER_REGISTRY)/$(DOCKER_REPO):$(DOCKER_TAG) $(DOCKER_REGISTRY)/$(DOCKER_REPO):latest
	@echo "$(GREEN)✅ Docker image built successfully!$(NC)"

docker-run: ## Run Docker container
	@echo "$(BLUE)🐳 Running Docker container...$(NC)"
	@docker run -p 80:80 $(DOCKER_REGISTRY)/$(DOCKER_REPO):$(DOCKER_TAG)

docker-stop: ## Stop all running containers
	@echo "$(BLUE)🐳 Stopping Docker containers...$(NC)"
	@docker-compose down

docker-logs: ## Show Docker container logs
	@echo "$(BLUE)🐳 Showing Docker logs...$(NC)"
	@docker-compose logs -f

docker-compose-up: ## Start services with docker-compose
	@echo "$(BLUE)🐳 Starting services with docker-compose...$(NC)"
	@docker-compose up -d

docker-compose-dev: ## Start development services with docker-compose
	@echo "$(BLUE)🐳 Starting development services...$(NC)"
	@docker-compose -f docker-compose.dev.yml up -d

# Deployment targets
deploy: ## Deploy to production
	@echo "$(BLUE)🚀 Deploying to production...$(NC)"
	@./scripts/deploy.sh

deploy-dev: ## Deploy to development environment
	@echo "$(BLUE)🚀 Deploying to development...$(NC)"
	@./scripts/deploy.sh --env dev

deploy-prod: ## Deploy to production environment
	@echo "$(BLUE)🚀 Deploying to production...$(NC)"
	@./scripts/deploy.sh --env prod

# Setup targets
setup: ## Setup development environment
	@echo "$(BLUE)⚙️  Setting up development environment...$(NC)"
	@make setup-dev
	@echo "$(GREEN)✅ Development environment setup complete!$(NC)"

setup-dev: ## Setup development dependencies
	@echo "$(BLUE)⚙️  Setting up development dependencies...$(NC)"
	@./scripts/setup-dev.sh
	@cd frontend && npm install
	@cd go && go mod tidy
	@echo "$(GREEN)✅ Development dependencies installed!$(NC)"

setup-prod: ## Setup production environment
	@echo "$(BLUE)⚙️  Setting up production environment...$(NC)"
	@make check-deps
	@echo "$(GREEN)✅ Production environment ready!$(NC)"

# Code quality targets
lint: ## Run linting
	@echo "$(BLUE)🔍 Running linter...$(NC)"
	@cd frontend && npm run lint
	@cd go && golangci-lint run

lint-fix: ## Fix linting issues
	@echo "$(BLUE)🔧 Fixing linting issues...$(NC)"
	@cd frontend && npm run lint:fix

format: ## Format code
	@echo "$(BLUE)🎨 Formatting code...$(NC)"
	@cd frontend && npm run format
	@cd go && gofmt -w .

check-deps: ## Check if all required dependencies are installed
	@echo "$(BLUE)🔍 Checking dependencies...$(NC)"
	@command -v go >/dev/null 2>&1 || { echo "$(RED)❌ Go is not installed. Please install Go $(GO_VERSION)+$(NC)"; exit 1; }
	@command -v node >/dev/null 2>&1 || { echo "$(RED)❌ Node.js is not installed. Please install Node.js $(NODE_VERSION)+$(NC)"; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "$(RED)❌ npm is not installed. Please install npm$(NC)"; exit 1; }
	@command -v docker >/dev/null 2>&1 || { echo "$(RED)❌ Docker is not installed. Please install Docker$(NC)"; exit 1; }
	@echo "$(GREEN)✅ All dependencies are installed!$(NC)"

# Utility targets
clean: ## Clean build artifacts
	@echo "$(BLUE)🧹 Cleaning build artifacts...$(NC)"
	@rm -rf dist/
	@rm -rf frontend/dist/
	@rm -rf frontend/node_modules/
	@rm -f main.wasm
	@rm -f wasm_exec.js
	@cd go && go clean
	@docker system prune -f >/dev/null 2>&1 || true
	@echo "$(GREEN)✅ Clean completed!$(NC)"

clean-all: ## Clean everything including dependencies
	@echo "$(BLUE)🧹 Cleaning everything...$(NC)"
	@make clean
	@rm -rf frontend/node_modules/
	@rm -rf go/vendor/
	@docker system prune -a -f >/dev/null 2>&1 || true
	@echo "$(GREEN)✅ Full clean completed!$(NC)"

# Information targets
info: ## Show project information
	@echo "$(BLUE)$(PROJECT_NAME) - Project Information$(NC)"
	@echo "Go Version: $(GO_VERSION)"
	@echo "Node Version: $(NODE_VERSION)"
	@echo "Docker Image: $(DOCKER_REGISTRY)/$(DOCKER_REPO):$(DOCKER_TAG)"
	@echo "Git Commit: $(shell git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
	@echo "Branch: $(shell git branch --show-current 2>/dev/null || echo 'unknown')"

# Quick development workflow
quick-dev: ## Quick development workflow (build + dev)
	@echo "$(BLUE)⚡ Quick development workflow...$(NC)"
	@make build
	@make dev

# CI/CD targets
ci: ## Run CI pipeline
	@echo "$(BLUE)🔄 Running CI pipeline...$(NC)"
	@make check-deps
	@make lint
	@make test-all
	@make build-prod
	@echo "$(GREEN)✅ CI pipeline completed successfully!$(NC)"

# Legacy targets (for backward compatibility)
build-all: build ## Alias for build
test-full: test-all ## Alias for test-all
dev-all: dev ## Alias for dev
setup-all: setup ## Alias for setup

# Environment-specific targets
dev-local: ## Start local development environment
	@echo "$(BLUE)🏠 Starting local development...$(NC)"
	@make setup-dev
	@make build
	@make dev

dev-docker: ## Start development with Docker
	@echo "$(BLUE)🐳 Starting development with Docker...$(NC)"
	@make docker-compose-dev

prod-local: ## Start production locally
	@echo "$(BLUE)🏭 Starting production locally...$(NC)"
	@make build-prod
	@make docker-run

# Monitoring and debugging
logs: docker-logs ## Alias for docker-logs

status: ## Show current status
	@echo "$(BLUE)📊 Current Status$(NC)"
	@echo "Frontend: $(shell cd frontend && npm list --depth=0 2>/dev/null | head -1 || echo 'Not installed')"
	@echo "Go modules: $(shell cd go && go list -m all 2>/dev/null | wc -l) modules"
	@echo "Docker images: $(shell docker images | grep $(DOCKER_REPO) | wc -l) images"
	@echo "Running containers: $(shell docker ps | grep $(DOCKER_REPO) | wc -l) containers"
