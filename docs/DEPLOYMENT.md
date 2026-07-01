# Resolve PM Enterprise Deployment Guide

## Prerequisites
- Node.js (v18 or higher)
- Supabase Project (PostgreSQL 15+)
- Modern Web Server (Nginx, Vercel, or AWS CloudFront/S3)

## Environment Setup
1. Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```
2. Populate the required keys (DO NOT USE `localhost` FOR PRODUCTION):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_PRODUCT_KEY_API_URL`

## Database Initialization
Run the canonical SQL installation file against your production database:
```sql
\i database/migrations/RESOLVE_PM_V1_3_INSTALL.sql
```

## Compilation
Build the frontend application for production:
```bash
npm run build
```

## Deployment
Upload the generated `dist/` directory to your static hosting provider.
Ensure that your host is configured to rewrite all unfound routes to `index.html` to support client-side routing.
