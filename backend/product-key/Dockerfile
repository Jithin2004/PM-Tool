# License Server Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "const http = require('http'); http.get('http://localhost:' + (process.env.PORT || 5000) + '/health', (r) => { if (r.statusCode !== 200) throw new Error(r.statusCode); });"

# Expose port
EXPOSE ${PORT:-5000}

# Start application
CMD ["npm", "start"]
