# Multi-stage build for Go WASM and React frontend
FROM golang:1.25-alpine AS go-builder

# Install git and ca-certificates (needed for go modules)
RUN apk add --no-cache git ca-certificates

# Set working directory
WORKDIR /app/go

# Copy go mod and sum files
COPY go/go.mod go/go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY go/ .

# Build WASM
RUN GOOS=js GOARCH=wasm go build -o /app/main.wasm -ldflags="-s -w" -trimpath

# Copy wasm_exec.js
RUN cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" /app/wasm_exec.js

# React build stage
FROM node:18-alpine AS react-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci --only=production

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
RUN apk update && apk upgrade && apk add --no-cache curl

# Copy custom nginx configuration
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from react-builder stage
COPY --from=react-builder /app/frontend/dist /usr/share/nginx/html

# Copy WASM files
COPY --from=go-builder /app/main.wasm /usr/share/nginx/html/
COPY --from=go-builder /app/wasm_exec.js /usr/share/nginx/html/

# Create non-root user and set permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /usr/share/nginx/html && \
    chown -R nextjs:nodejs /var/cache/nginx && \
    chown -R nextjs:nodejs /var/log/nginx && \
    chown -R nextjs:nodejs /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nextjs:nodejs /var/run/nginx.pid

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]