# Resolve PM: On-Premise Deployment Guide

This guide provides instructions for System Administrators to deploy the Resolve PM frontend application onto internal enterprise infrastructure using Docker.

## Prerequisites
- **Docker Engine** (v20.10.0+)
- **Docker Compose** (v2.0.0+)
- Active Supabase instance (Cloud or Self-Hosted)

## 1. Prepare Environment Variables

Vite statically bakes environment variables into the frontend bundle at **build time**. 
You must define these variables in a `.env` file before executing the Docker build.

Create a `.env` file in the root directory:
```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 2. Docker Compose Configuration

The provided `docker-compose.yml` orchestrates the container. If you are deploying only the client, you can use the following simplified configuration:

```yaml
version: '3.8'

services:
  resolve-pm-client:
    container_name: resolve-pm-client
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
        - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
    ports:
      - "80:80"
      - "443:443"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 3. Build and Deploy

Navigate to the directory containing your `docker-compose.yml` and `.env` files.

1. **Build the container and start the service:**
   ```bash
   docker-compose up -d --build
   ```

2. **Verify the deployment:**
   ```bash
   docker-compose ps
   ```
   Ensure the `resolve-pm-client` container shows an `Up (healthy)` status.

3. **Access the application:**
   Navigate to `http://<your-server-ip>` in your browser. The Nginx server is configured to gracefully fallback to `index.html` for React Router navigation.

## 4. Maintenance

**To update the application:**
1. Pull the latest source code.
2. Rebuild the image: `docker-compose up -d --build resolve-pm-client`
3. Prune old dangling images: `docker image prune -f`

**To view live logs:**
```bash
docker-compose logs -f resolve-pm-client
```
