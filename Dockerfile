# Multi-stage build for Go WASM and React frontend
ARG GO_VERSION=1.25
FROM golang:${GO_VERSION}-alpine AS go-builder

# Install git and ca-certificates (needed for go modules)
RUN apk add --no-cache git ca-certificates

# Set working directory
WORKDIR /app/go

# Copy go.mod to bootstrap
COPY go/go.mod ./

# Download dependencies
RUN go mod download

# Copy the rest of the source code
COPY go/ .

# Regenerate go.sum if needed
RUN go mod tidy

# Build WASM
RUN GOOS=js GOARCH=wasm go build -o /app/main.wasm -ldflags="-s -w" -trimpath

# Copy wasm_exec.js (location varies across Go versions)
RUN set -e; \
    GOROOT=$(go env GOROOT); \
    if [ -f "$GOROOT/lib/wasm/wasm_exec.js" ]; then \
        cp "$GOROOT/lib/wasm/wasm_exec.js" /app/wasm_exec.js; \
    elif [ -f "$GOROOT/misc/wasm/wasm_exec.js" ]; then \
        cp "$GOROOT/misc/wasm/wasm_exec.js" /app/wasm_exec.js; \
    else \
        echo "wasm_exec.js not found" >&2; \
        exit 1; \
    fi

# Astro build stage
FROM node:20-alpine AS astro-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install ALL dependencies (including devDependencies needed for build)
# Using npm ci for deterministic, fast installs
RUN npm ci --include=optional

# Copy source code
COPY frontend/ .

# Copy WASM files from go-builder stage
COPY --from=go-builder /app/main.wasm public/
COPY --from=go-builder /app/wasm_exec.js public/

# Build the application (devDependencies available during build)
RUN npm run build

# Clean up node_modules to reduce image size (optional, but keeps build cache clean)
RUN rm -rf node_modules

# Production dependencies stage (optional - for Node.js runtime if needed)
FROM node:20-alpine AS production-deps
WORKDIR /app/frontend
COPY frontend/package*.json ./
# Install only production dependencies
RUN npm ci --omit=dev --omit=optional && npm cache clean --force

# Final runtime stage with Nginx (no Node.js runtime needed)
# Note: If using Node.js runtime instead, use:
# FROM node:20-alpine AS runtime
# WORKDIR /app/frontend
# COPY --from=production-deps /app/frontend/node_modules ./node_modules
# COPY --from=astro-builder /app/frontend/dist ./dist
# COPY --from=astro-builder /app/frontend/package*.json ./
# EXPOSE 3000
# CMD ["npm", "run", "preview"]
FROM nginx:alpine

# Install security updates
# Note: curl removed - using busybox wget instead for smaller image size

# Copy custom nginx configuration
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from astro-builder stage
COPY --from=astro-builder /app/frontend/dist /usr/share/nginx/html

# Copy WASM files
COPY --from=go-builder /app/main.wasm /usr/share/nginx/html/
COPY --from=go-builder /app/wasm_exec.js /usr/share/nginx/html/

# (Optional hardening: use 8080 or setcap cap_net_bind_service; otherwise run as root for :80)

# Health check using busybox wget (available in nginx:alpine)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]