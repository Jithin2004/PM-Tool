'use strict';

const jwt = require('jsonwebtoken');

// Read once at module load. If missing, startup validation in index.js will
// have already exited the process — this guard is belt-and-suspenders.
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

/**
 * Auth middleware.
 *
 * Verifies the Supabase JWT signature using SUPABASE_JWT_SECRET.
 * On success, sets req.user = { id: decoded.sub } for downstream handlers.
 *
 * Previously used jwt.decode() (no signature check).
 * Now uses jwt.verify() — callers without a valid Supabase JWT are rejected.
 */
const authMiddleware = (req, res, next) => {
    // OAuth callback carries state, not a Bearer token — skip this path.
    if (req.path === '/oauth2callback') return next();

    if (!SUPABASE_JWT_SECRET) {
        console.error('[AUTH] SUPABASE_JWT_SECRET is not configured.');
        return res.status(500).json({ error: 'Server authentication not configured' });
    }

    const authHeader = req.headers.authorization;

    // Support legacy query-param token path (e.g. /auth/google redirect flows).
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (req.query.token) {
            try {
                const decoded = jwt.verify(req.query.token, SUPABASE_JWT_SECRET);
                if (decoded?.sub) {
                    req.user = { id: decoded.sub };
                    return next();
                }
            } catch {
                return res.status(401).json({ error: 'Invalid token' });
            }
        }
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, SUPABASE_JWT_SECRET);
        if (!decoded?.sub) {
            return res.status(401).json({ error: 'Invalid token structure' });
        }
        req.user = { id: decoded.sub };
        next();
    } catch (error) {
        // jwt.verify throws JsonWebTokenError, TokenExpiredError, NotBeforeError
        return res.status(401).json({ error: 'Token verification failed' });
    }
};

module.exports = authMiddleware;
