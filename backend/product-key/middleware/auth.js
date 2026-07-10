'use strict';

const { supabaseAnon } = require('../lib/supabase');

/**
 * Auth middleware.
 *
 * Authenticates requests using the Supabase Auth API (`getUser`).
 * Treats Supabase as the exclusive Identity Provider.
 *
 * Populates `req.user` with minimal identity (id, email).
 */
const authMiddleware = async (req, res, next) => {
    // OAuth callback carries state, not a Bearer token — skip this path.
    if (req.path === '/oauth2callback') return next();

    if (!supabaseAnon) {
        console.error('[AUTH] supabaseAnon client is not initialized. Check SUPABASE_URL and SUPABASE_ANON_KEY.');
        return res.status(500).json({ error: 'Server authentication not configured' });
    }

    const authHeader = req.headers.authorization;
    let token = null;

    // Extract token from Bearer header or legacy query param
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        console.warn('[AUTH] AUTH_MISSING_TOKEN: Request rejected');
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    try {
        const { data: { user }, error } = await supabaseAnon.auth.getUser(token);

        if (error || !user) {
            console.warn(`[AUTH] AUTH_INVALID_TOKEN: ${error?.message || 'User not found'}`);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Populate req.user with minimal identity required by the application
        req.user = { 
            id: user.id,
            email: user.email
        };

        next();
    } catch (error) {
        console.error(`[AUTH] AUTH_EXPIRED_TOKEN / VERIFICATION_ERROR: ${error.message}`);
        return res.status(401).json({ error: 'Token verification failed' });
    }
};

module.exports = authMiddleware;
