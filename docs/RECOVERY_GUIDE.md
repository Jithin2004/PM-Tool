# Resolve PM v1.3 — Disaster Recovery & Restoration Guide

> **Document Class:** Internal Operations  
> **Version:** 1.3.0-internal-stable  
> **Last Updated:** June 2026  
> **Maintained By:** Infrastructure Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Recovery Time Objectives](#2-recovery-time-objectives)
3. [Database Recovery](#3-database-recovery)
4. [Application Recovery](#4-application-recovery)
5. [License Recovery](#5-license-recovery)
6. [Full Environment Rebuild](#6-full-environment-rebuild)
7. [Rollback Procedures](#7-rollback-procedures)
8. [Verification Checklist](#8-verification-checklist)

---

## 1. Overview

This guide documents the recovery procedures for Resolve PM v1.3. It covers:

- **Database crash recovery** using pg_dump backups and schema reinstall
- **Application container recovery** from Docker image rebuild
- **License reinstatement** for offline and server-side key recovery
- **Full environment rebuild** from scratch using the production SQL installer

### System Architecture

```
┌─────────────────────────────────────────────────┐
│            Docker Compose Stack                  │
│                                                  │
│  [resolvepm-app]  ←→  [license-server]           │
│         ↓                    ↓                   │
│  [postgres:5432]  ←→  [pgbackup sidecar]         │
│         ↓                                        │
│  [postgres-data volume]  [backup-data volume]    │
└─────────────────────────────────────────────────┘
```

---

## 2. Recovery Time Objectives

| Scenario | RTO Target | RPO Target |
|---|---|---|
| Single container crash | < 2 min (auto-restart) | 0 (no data loss) |
| Database corruption | < 30 min | Last daily backup (~24h) |
| Full server loss | < 2 hours | Last daily backup (~24h) |
| License server failure | < 15 min | N/A (stateless) |
| Full environment rebuild | < 4 hours | Last daily backup |

---

## 3. Database Recovery

### 3.1 Check Database Health

```bash
# Verify postgres container is running
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres --tail=50

# Connect and check tables
docker compose exec postgres psql -U resolvepm_admin -d resolvepm -c "\dt"
```

### 3.2 Restore from Automated Backup

Backups are stored in the `backup-data` Docker volume by the `pgbackup` sidecar. They are retained for **7 days**.

```bash
# List available backups
docker compose exec pgbackup ls -lh /backups/

# Identify target backup (most recent)
BACKUP_FILE="resolvepm_20260610_020000.pgdump"

# Stop the application to prevent writes during restore
docker compose stop resolvepm-app

# Drop and recreate the database
docker compose exec postgres psql -U resolvepm_admin -c "DROP DATABASE IF EXISTS resolvepm;"
docker compose exec postgres psql -U resolvepm_admin -c "CREATE DATABASE resolvepm;"

# Restore from backup
docker compose exec pgbackup pg_restore \
  -h postgres \
  -U resolvepm_admin \
  -d resolvepm \
  -v \
  /backups/$BACKUP_FILE

# Restart application
docker compose start resolvepm-app
```

### 3.3 Fresh Schema Install (Zero Data)

Use this when a clean database is required (e.g., new environment setup).

```bash
# Copy the production SQL installer into the postgres container
docker compose cp \
  database/production/RESOLVE_PM_V1_3_INSTALL.sql \
  postgres:/tmp/RESOLVE_PM_V1_3_INSTALL.sql

# Execute the installer on a clean database
docker compose exec postgres psql \
  -U resolvepm_admin \
  -d resolvepm \
  -f /tmp/RESOLVE_PM_V1_3_INSTALL.sql

# Verify tables were created
docker compose exec postgres psql \
  -U resolvepm_admin \
  -d resolvepm \
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
```

### 3.4 Verify Database Integrity

```bash
# Run PostgreSQL internal consistency checks
docker compose exec postgres psql -U resolvepm_admin -d resolvepm \
  -c "SELECT schemaname, tablename, attname FROM pg_stats WHERE schemaname='public' LIMIT 20;"

# Check row counts on key tables
docker compose exec postgres psql -U resolvepm_admin -d resolvepm -c "
  SELECT 'workspaces' AS tbl, COUNT(*) FROM workspaces
  UNION ALL
  SELECT 'projects', COUNT(*) FROM projects
  UNION ALL
  SELECT 'tasks', COUNT(*) FROM tasks
  UNION ALL
  SELECT 'users', COUNT(*) FROM users;
"
```

---

## 4. Application Recovery

### 4.1 Single Container Restart

All containers have `restart: unless-stopped` — they auto-restart after crashes.

```bash
# Force restart a specific service
docker compose restart resolvepm-app

# View live logs
docker compose logs resolvepm-app -f
```

### 4.2 Rebuild Application Image

```bash
# Pull latest env config
cp .env.production .env

# Rebuild and redeploy (no downtime gap > 30s)
docker compose build resolvepm-app
docker compose up -d resolvepm-app
```

### 4.3 Full Stack Restart

```bash
# Graceful restart — preserves volumes
docker compose down
docker compose up -d

# Force fresh start — WARNING: deletes all data
docker compose down -v
docker compose up -d --build
```

### 4.4 Verify Application Health

```bash
# Check health endpoints
curl -s http://localhost:3000/health
# Expected: "OK"

curl -s http://localhost:5000/health
# Expected: {"status":"ok","version":"1.3.0"}
```

---

## 5. License Recovery

### 5.1 Customer License File Lost

If a customer loses their `license.json`, re-sign a new one using the generator:

```bash
# Navigate to the license key backend
cd backend/product-key

# Re-sign a license for the customer using existing private key
node generate_license.js \
  --sign-only \
  --customer "Customer Company Name" \
  --plan BUSINESS \
  --days 365

# A new license.json is created — send to customer
```

> ⚠️ **Important:** Always use `--sign-only` to avoid regenerating the keypair. The public key is already embedded in the deployed frontend.

### 5.2 Private Key Lost

If the private key (`backend/product-key/keys/private_key.pem`) is lost:

1. **Generate a new keypair:**
   ```bash
   node generate_license.js --customer "Temp" --days 1
   ```

2. **Update the public JWK in the frontend** (`frontend/src/lib/productKey.ts`) with the contents of `keys/public_key.jwk.json`.

3. **Rebuild and redeploy the frontend:**
   ```bash
   docker compose build resolvepm-app
   docker compose up -d resolvepm-app
   ```

4. **Re-issue licenses** to all existing customers using the new private key.

### 5.3 Customer License Verification Failure

If a customer reports the license is rejected:

```bash
# Verify the license manually using Node.js
node -e "
const fs = require('fs');
const { subtle } = require('crypto').webcrypto;

async function verify() {
  const license = JSON.parse(fs.readFileSync('./license.json', 'utf8'));
  const pubJwk  = JSON.parse(fs.readFileSync('./backend/product-key/keys/public_key.jwk.json', 'utf8'));
  
  const pubKey = await subtle.importKey(
    'jwk', pubJwk,
    { name: 'RSA-PSS', hash: 'SHA-256' },
    false, ['verify']
  );
  
  const sigBuf = Buffer.from(
    license.signature.replace(/-/g,'+').replace(/_/g,'/'),
    'base64'
  );
  
  const valid = await subtle.verify(
    { name: 'RSA-PSS', saltLength: 32 },
    pubKey,
    sigBuf,
    Buffer.from(JSON.stringify(license.payload))
  );
  
  console.log('Signature valid:', valid);
  console.log('Expires:', new Date(license.payload.expiresAt).toISOString());
  console.log('Plan:', license.payload.plan);
}

verify().catch(console.error);
"
```

---

## 6. Full Environment Rebuild

Use this procedure when the entire server is lost or a new deployment is needed.

### 6.1 Prerequisites

- Docker Engine 24+ installed
- Docker Compose v2+ installed
- Production `.env` file with all required variables
- Database backup file OR fresh install (zero data)
- License private key (`private_key.pem`)

### 6.2 Required `.env` Variables

```env
# Database
POSTGRES_DB=resolvepm
POSTGRES_USER=resolvepm_admin
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_PORT=5432

# Application
APP_PORT=3000
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>

# License Server
LICENSE_PORT=5000
VITE_PRODUCT_KEY_API_URL=http://localhost:5000
```

### 6.3 Rebuild Steps

```bash
# 1. Clone or copy the repository to the new server
#    (Ensure .env is present with all values above)

# 2. Register the private key as a Docker secret
docker secret create license_private_key ./backend/product-key/keys/private_key.pem

# 3. Start the full stack (fresh install via init script)
docker compose up -d --build

# 4. Monitor startup
docker compose logs -f

# 5. Wait for postgres healthcheck (30s), then verify
curl http://localhost:3000/health   # → OK
curl http://localhost:5000/health   # → {"status":"ok"}

# 6. Restore from backup (if data exists)
# See Section 3.2 above
```

---

## 7. Rollback Procedures

### 7.1 Application Rollback

```bash
# Tag the current image before deploying
docker tag resolvepm-app:latest resolvepm-app:backup-$(date +%Y%m%d)

# If new deployment fails, roll back
docker compose stop resolvepm-app
docker tag resolvepm-app:backup-<YYYYMMDD> resolvepm-app:latest
docker compose up -d resolvepm-app
```

### 7.2 Database Schema Rollback

The production schema installer is idempotent. Partial rollbacks are not supported — restore from backup instead (see Section 3.2).

---

## 8. Verification Checklist

Run this checklist after any recovery operation:

```
☐ docker compose ps — all services show "healthy"
☐ GET http://localhost:3000/health → "OK"
☐ GET http://localhost:5000/health → {"status":"ok"}
☐ Login to Resolve PM with a test user — no 500 errors
☐ Activate a test license.json via Product Key Gate
☐ Create a workspace, project, and task — verify they persist
☐ Verify pgbackup produced a .pgdump file in /backups/
☐ Confirm audit log table has entries (SELECT * FROM audit_log LIMIT 5)
```

---

*This document is classified as Internal Operations. Do not distribute externally.*
