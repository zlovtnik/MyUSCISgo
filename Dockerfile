# Multi-stage build for Go WASM and React frontend
ARG GO_VERSION=1.25
FROM golang:${GO_VERSION}-alpine AS go-builder

# Install git and ca-certificates (needed for go modules)
RUN apk add --no-cache git ca-certificates

# Set working directory
WORKDIR /app/go

# Copy go mod and sum files
COPY go/go.mod ./
COPY go/go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY go/ .

# Build WASM
RUN GOOS=js GOARCH=wasm go build -o /app/main.wasm -ldflags="-s -w" -trimpath

# Copy wasm_exec.js (location varies across Go versions)
RUN WASM_EXEC_PATH=$(find "$(go env GOROOT)" -name "wasm_exec.js" -type f 2>/dev/null | head -1) && \
    if [ -n "$WASM_EXEC_PATH" ]; then \
        cp "$WASM_EXEC_PATH" /app/wasm_exec.js; \
    else \
        echo "Error: wasm_exec.js not found in Go installation" >&2 && exit 1; \
    fi

# React build stage
FROM node:20-alpine AS react-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install ALL dependencies (including devDependencies needed for build)
# Using npm ci for deterministic, fast installs
RUN npm ci

# Copy source code
COPY frontend/ .

# Copy WASM files from go-builder stage
COPY --from=go-builder /app/main.wasm public/
COPY --from=go-builder /app/wasm_exec.js public/

# Build the application (devDependencies available during build)
RUN npm run build

# Final runtime stage with Nginx (no Node.js runtime needed)
# Note: If using Node.js runtime instead, use:
# FROM node:20-alpine AS runtime
# COPY --from=react-builder /app/frontend/package*.json ./
# RUN npm ci --omit=dev && npm cache clean --force
# COPY --from=react-builder /app/frontend/dist ./dist
FROM nginx:alpine

# Install security updates
# Note: curl removed - using busybox wget instead for smaller image size

# Copy custom nginx configuration
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from react-builder stage
COPY --from=react-builder /app/frontend/dist /usr/share/nginx/html

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