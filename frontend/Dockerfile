# Stage 1: Build the React Application
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build arguments for environment variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Expose them to Vite during the build process so they bake into the static bundle
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Install dependencies first to cache the layer
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Execute the Vite production build
RUN npm run build

# Stage 2: Serve the Application using Nginx
FROM nginx:alpine

# Configure Nginx to support React Router (client-side routing fallback)
RUN echo "server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files \$uri \$uri/ /index.html; \
    } \
}" > /etc/nginx/conf.d/default.conf

# Copy the compiled static assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
