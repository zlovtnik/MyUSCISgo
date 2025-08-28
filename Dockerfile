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

# Copy wasm_exec.js
RUN cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" /app/wasm_exec.js

# React build stage
FROM node:20-alpine AS react-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies (fix rollup issue by using npm install and explicit rollup)
RUN npm install --production && npm install @rollup/rollup-linux-arm64-musl --save-optional

# Copy source code
COPY frontend/ .

# Copy WASM files from go-builder stage
COPY --from=go-builder /app/main.wasm public/
COPY --from=go-builder /app/wasm_exec.js public/

# Build the application
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

# Install security updates
RUN apk add --no-cache curl

# Copy custom nginx configuration
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from react-builder stage
COPY --from=react-builder /app/frontend/dist /usr/share/nginx/html

# Copy WASM files
COPY --from=go-builder /app/main.wasm /usr/share/nginx/html/
COPY --from=go-builder /app/wasm_exec.js /usr/share/nginx/html/

# (Optional hardening: use 8080 or setcap cap_net_bind_service; otherwise run as root for :80)

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]