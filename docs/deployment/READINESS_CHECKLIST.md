# Render Deployment Readiness Checklist ✅

**Last Updated**: June 11, 2026  
**Status**: ⚠️ **CONDITIONAL** - Ready with configuration validation

---

## 🚀 Critical Issues Fixed

### 1. **License Server Infrastructure** ✅
- [x] Added connection timeout (5 seconds) - prevents hanging on DB unreachable
- [x] Created missing Dockerfile for `backend/product-key`
- [x] Added `/health` endpoint for Render health checks
- [x] Support multiple env var formats (MONGO_URI, DB, DATABASE_URL)
- [x] MongoDB URI format validation

### 2. **Database Performance** ✅
- [x] Added indexes to AuditEvent (timestamp, license_key, compound index)
- [x] Added pagination to admin endpoints (max 1000 records per request)
- [x] Using `.lean()` queries for read-only operations

### 3. **Frontend Load Times** ✅
- [x] Reduced auth retry delays: 3.75s → 400ms (2 retries instead of 4)
- [x] Reduced safety timeouts: 15s → 10s
- [x] Code splitting optimized (14 chunks)
- [x] Gzip compression enabled on Nginx
- [x] Cache headers configured (1-year TTL for assets)
- [x] Supabase fetch timeout: 10 seconds

---

## ⚠️ Pre-Deployment Configuration

**You MUST verify these before deploying to Render:**

### Render Environment Variables (License Server)

Set on https://dashboard.render.com → Select `pm-tool-server` → Environment

```
# Database connection (required)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/resolve_pm
  OR
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/resolve_pm

# JWT Secret (required)
JWT_SECRET=<generate-a-secure-32-char-random-string>

# Optional
LICENSE_SECRET=<optional-admin-key>
NODE_ENV=production
```

**⚠️ Critical**: If `MONGO_URI`/`DB`/`DATABASE_URL` is not set, the server will **exit immediately**.

### MongoDB Atlas Requirements

- ✅ Network access: Allow Render's IP ranges (or set to 0.0.0.0 for testing)
- ✅ Database: Create `resolve_pm` database in MongoDB
- ✅ Cluster: Use **M2 tier minimum** (M0 free tier may timeout)
- ✅ Connection string: Use `mongodb+srv://` protocol

**Test MongoDB Connection**:
```bash
# On Render terminal or local
mongosh "mongodb+srv://user:pass@cluster.mongodb.net/resolve_pm" --eval "db.version()"
```

### Supabase Configuration (Frontend)

Set in `.env.local` or during frontend build:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxxxx...
VITE_PRODUCT_KEY_API_URL=https://pm-tool-server.onrender.com  # your license server URL
```

**Verify Supabase Connection**:
- [ ] Test login at https://your-app.onrender.com/login
- [ ] Check browser console (F12 → Console) for errors

---

## 📊 Performance Expectations

| Metric | Target | Status |
|--------|--------|--------|
| **Initial load** | < 3 seconds | ✅ Optimized |
| **License verification** | < 500ms | ✅ Has timeout |
| **Database index response** | < 50ms | ✅ Indexes added |
| **Health check** | < 100ms | ✅ Endpoint ready |
| **Nginx cache hits** | 80%+ | ✅ Configured |

**Post-deployment**, measure actual performance:
1. Open DevTools (F12) → Network tab
2. Hard refresh (Ctrl+Shift+R)
3. Check "Waterfall" view for slow endpoints

---

## 🔒 Security Pre-Flight

- [ ] Set `NODE_ENV=production` on Render
- [ ] Disable `sourcemap` in production builds
- [ ] Verify MongoDB credentials are in Render secrets (not code)
- [ ] Enable Render's auto-deploy on git push (optional but recommended)
- [ ] Review Content-Security-Policy headers in nginx.conf

**Security Scan**:
```bash
# Check for hardcoded secrets
git log --all -p | grep -i "password\|secret\|key" | head -20
```

---

## ✅ Deployment Steps

### Step 1: Prepare MongoDB on Atlas

```
1. Log in to MongoDB Atlas
2. Create cluster (M2 tier minimum)
3. Create user with password
4. Get connection string: mongodb+srv://user:pass@...
5. Add Render IP to Network Access (or 0.0.0.0/0 for testing)
6. Create database: resolve_pm
```

### Step 2: Configure Render License Server

```
1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect GitHub repo
4. Settings:
   - Name: pm-tool-server (or your choice)
   - Runtime: Node
   - Build Command: npm ci
   - Start Command: npm start
   - Plan: Free or Starter ($7/mo)
5. Add Environment Variables (from section above)
6. Deploy
```

### Step 3: Verify License Server Health

```bash
# Test health endpoint
curl https://pm-tool-server.onrender.com/health

# Expected: { "status": "ok", "timestamp": "..." }
```

### Step 4: Update Frontend Configuration

```
1. Update VITE_PRODUCT_KEY_API_URL to point to your license server
2. Redeploy frontend to Render
3. Test license verification flow
```

---

## 🧪 Post-Deployment Testing

### Smoke Tests (5 minutes)

- [ ] Load app homepage (should load in < 3 seconds)
- [ ] Create test account and sign in
- [ ] Navigate to dashboard (should be responsive)
- [ ] Open DevTools → Network → check no 500 errors
- [ ] Check `/health` endpoint returns 200

### Extended Tests (15 minutes)

- [ ] Test license key upload/verification
- [ ] Create a project and add tasks
- [ ] Check admin panel loads (AdminPanel chunk)
- [ ] Test search functionality
- [ ] Verify real-time updates work

### Load Test (Optional)

```bash
# Simple load test with artillery
npm install -g artillery
artillery quick --count 100 --num 10 https://your-app.onrender.com
```

---

## 🚨 Troubleshooting

### "504 Gateway Timeout" or "No response"

**Likely cause**: MongoDB connection timeout
**Fix**:
```bash
# Check logs on Render
1. Render Dashboard → pm-tool-server → Logs
2. Look for "[DB] Connecting to MongoDB"
3. Verify MONGO_URI env var is correct
4. Check MongoDB Network Access allows Render IPs
```

### "Loading..." screen doesn't resolve

**Likely cause**: Auth context is stuck waiting for Supabase
**Fix**:
```bash
1. Open DevTools (F12)
2. Network tab → look for failed requests to supabase.co
3. Check VITE_SUPABASE_URL is correct
4. Wait 10 seconds (safety timeout) or refresh
```

### High memory usage on Render

**Likely cause**: Large database queries without pagination
**Fix**:
- ✅ Already paginated in `adminGetActivations` and `adminGetEvents`
- Use `?limit=50&skip=0` query params
- Check browser DevTools → Application → Local Storage for rogue cached data

---

## 📈 Monitoring Recommendations

### Essential Metrics

```
1. Response times: Track /verify, /activate endpoints
2. Error rates: Monitor 4xx, 5xx responses
3. Database latency: Monitor MongoDB query times
4. Render uptime: Use Render's built-in monitoring
```

### Recommended Tools

- **New Relic**: Free tier, good for Node.js monitoring
- **Sentry**: Free tier, tracks JS errors in frontend
- **MongoDB Atlas Charts**: Visualize database metrics

---

## 🎯 Go-Live Readiness

| Item | Status | Owner |
|------|--------|-------|
| MongoDB setup | ⚠️ **TODO** | You |
| Render license server deployed | ⚠️ **TODO** | You |
| Env vars configured | ⚠️ **TODO** | You |
| Health checks passing | ⚠️ **TODO** | You |
| Performance validated | ⚠️ **TODO** | You |
| Security review | ⚠️ **TODO** | You |

### **Recommendation**: 
✅ **YES, you can rely on and use this app** — once you complete the configuration steps above.

**Timeline**: 
- 15 minutes to set up MongoDB
- 10 minutes to deploy license server to Render
- 5 minutes for smoke tests

**Total**: ~30 minutes from now you can have a working deployment.

---

## 📞 Support

If you encounter issues after deployment:

1. Check Render logs: Dashboard → Logs tab
2. Review this checklist section by section
3. Verify all environment variables are set
4. Test health endpoints: `/health` on license server
5. Check MongoDB connectivity from Render's terminal

---

**You are CLEARED for deployment with configuration validation.** 🚀
