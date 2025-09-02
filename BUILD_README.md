# MyUSCISgo - Build System

A comprehensive build system for the Go WASM + React TypeScript application with USCIS API integration.

## 🚀 Quick Start

```bash
# Setup development environment
make setup

# Start development servers
make dev

# Build for production
make build-prod

# Run tests
make test-all
```

## 📋 Available Commands

### Development

- `make dev` - Start development environment (frontend + backend)
- `make dev-frontend` - Start frontend development server only
- `make dev-backend` - Start backend development server only
- `make dev-local` - Start local development with full setup
- `make dev-docker` - Start development with Docker

### Building

- `make build` - Build all components for development
- `make build-wasm` - Build Go WASM binary only
- `make build-frontend` - Build React frontend only
- `make build-prod` - Build for production
- `make quick-dev` - Quick development workflow (build + dev)

### Testing

- `make test` - Run all tests
- `make test-unit` - Run unit tests only
- `make test-integration` - Run integration tests only
- `make test-e2e` - Run end-to-end tests only
- `make test-all` - Run comprehensive test suite
- `make test-watch` - Run tests in watch mode

### Docker

- `make docker-build` - Build Docker image
- `make docker-run` - Run Docker container
- `make docker-stop` - Stop all running containers
- `make docker-logs` - Show Docker container logs
- `make docker-compose-up` - Start services with docker-compose
- `make docker-compose-dev` - Start development services

### Deployment

- `make deploy` - Deploy to production
- `make deploy-dev` - Deploy to development environment
- `make deploy-prod` - Deploy to production environment

### Setup

- `make setup` - Setup development environment
- `make setup-dev` - Setup development dependencies
- `make setup-prod` - Setup production environment

### Code Quality

- `make lint` - Run linting
- `make lint-fix` - Fix linting issues
- `make format` - Format code
- `make check-deps` - Check if all required dependencies are installed

### Utility

- `make clean` - Clean build artifacts
- `make clean-all` - Clean everything including dependencies
- `make info` - Show project information
- `make status` - Show current status
- `make help` - Show this help message

## 🛠️ Prerequisites

- Go 1.21+
- Node.js 20+
- Docker & Docker Compose
- Make

### Check Prerequisites

```bash
make check-deps
```

## 🏗️ Project Structure

```
MyUSCISgo/
├── Makefile              # Build system
├── docker-compose.yml    # Production services
├── docker-compose.dev.yml # Development services
├── Dockerfile           # Production container
├── Dockerfile.dev       # Development container
├── .env.example         # Environment variables template
├── go/                  # Go WASM backend
│   ├── main.go
│   ├── go.mod
│   └── pkg/
├── frontend/            # React TypeScript frontend
│   ├── package.json
│   ├── Dockerfile.dev
│   └── src/
├── scripts/             # Deployment scripts
├── nginx/               # Nginx configuration
└── dist/                # Build output
```

## 🚀 Development Workflow

### 1. Initial Setup
```bash
# Clone repository
git clone <repository-url>
cd MyUSCISgo

# Setup environment
make setup

# Copy environment template
cp .env.example .env
# Edit .env with your values
```

### 2. Development
```bash
# Start development servers
make dev

# Or use quick development workflow
make quick-dev
```

### 3. Testing
```bash
# Run all tests
make test-all

# Run tests in watch mode
make test-watch
```

### 4. Building
```bash
# Build for development
make build

# Build for production
make build-prod
```

### 5. Docker Development
```bash
# Start with Docker
make dev-docker

# View logs
make docker-logs
```

## 🚢 Production Deployment

### Using Docker
```bash
# Build production image
make docker-build

# Run production container
make docker-run
```

### Using Docker Compose
```bash
# Start production services
make docker-compose-up
```

### Using Deployment Script
```bash
# Deploy to production
make deploy-prod
```

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# USCIS API
USCIS_CLIENT_ID=your-client-id
USCIS_CLIENT_SECRET=your-client-secret

# Endpoints
USCIS_DEV_URL=https://api-int.uscis.gov
USCIS_STAGING_URL=https://api-staging.uscis.gov
USCIS_PROD_URL=https://api.uscis.gov

# HTTP Configuration
HTTP_TIMEOUT=30s
RETRY_MAX_ATTEMPTS=3
```

### Docker Configuration

The build system supports multiple environments:

- **Development**: `docker-compose.dev.yml`
- **Production**: `docker-compose.yml`
- **Custom**: Create your own compose files

## 🧪 Testing Strategy

### Unit Tests
```bash
make test-unit
```
- Go packages: `go test ./pkg/...`
- Frontend: `npm run test:unit`

### Integration Tests
```bash
make test-integration
```
- API integration tests
- Component integration tests

### End-to-End Tests
```bash
make test-e2e
```
- Playwright E2E tests
- Full user workflow tests

### Comprehensive Testing
```bash
make test-all
```
Runs all test types in sequence.

## 📊 CI/CD Pipeline

The build system includes CI/CD support:

```bash
# Run full CI pipeline
make ci
```

This includes:
- Dependency checks
- Linting
- All tests
- Production build

## 🐳 Docker Images

### Production Image
- Multi-stage build (Go WASM + React)
- Nginx serving static files
- Optimized for size and performance

### Development Images
- Hot reload support
- Volume mounting for live editing
- Separate services for frontend/backend

## 📝 Scripts

### Custom Scripts
- `scripts/deploy.sh` - Production deployment
- `scripts/setup-dev.sh` - Development setup

### Build Script (Legacy)
- `build.ts` - Deno-based build system (still available)

## 🔍 Troubleshooting

### Common Issues

1. **WASM Build Fails**
   ```bash
   make clean
   make build-wasm
   ```

2. **Frontend Build Fails**
   ```bash
   cd frontend
   rm -rf node_modules
   npm install
   ```

3. **Docker Issues**
   ```bash
   make docker-stop
   make clean
   make docker-build
   ```

4. **Permission Issues**
   ```bash
   sudo chown -R $(whoami):$(whoami) .
   ```

### Debug Commands
```bash
# Show current status
make status

# Show project info
make info

# Check dependencies
make check-deps
```

## 📈 Performance

### Build Optimization
- Go WASM: `-ldflags="-s -w"` for size reduction
- Frontend: Vite production build with tree shaking
- Docker: Multi-stage builds for minimal image size

### Development Performance
- Hot reload for both frontend and backend
- Parallel builds with `make -j2`
- Volume mounting for instant file changes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Run tests: `make test-all`
5. Build: `make build-prod`
6. Submit pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Help

For help with specific commands:
```bash
make help
```

For issues or questions, please create an issue in the repository.
