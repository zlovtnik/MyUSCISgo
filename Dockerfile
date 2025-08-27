# Use the official nginx image as the base image
FROM nginx:alpine

# Copy the static files to the nginx html directory
COPY dist/index.html /usr/share/nginx/html/
COPY dist/main.wasm /usr/share/nginx/html/
COPY dist/wasm_exec.js /usr/share/nginx/html/

# Enable gzip compression
RUN echo 'gzip on;' > /etc/nginx/conf.d/gzip.conf && \
    echo 'gzip_types application/wasm application/javascript text/css;' >> /etc/nginx/conf.d/gzip.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]