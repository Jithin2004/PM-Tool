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
const logger = require('../lib/logger');

const authMiddleware = async (req, res, next) => {
    // OAuth callback carries state, not a Bearer token — skip this path.
    if (req.path === '/oauth2callback') return next();

    const ctx = req.traceContext;
    const authSpan = logger.startSpan('AUTH', 'AUTH-101', ctx);

    if (!supabaseAnon) {
        logger.error('AUTH', 'AUTH-101', ctx, 'supabaseAnon client not initialized');
        authSpan.finish('FAILED', { errorCode: 'AUTH_NOT_CONFIGURED', errorMessage: 'supabaseAnon client not initialized' });
        return res.status(500).json({ error: 'Server authentication not configured' });
    }

    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        logger.security('AUTH', 'AUTH-101', ctx, 'AUTH_MISSING_TOKEN: Request rejected');
        authSpan.finish('FAILED', { errorCode: 'AUTH_MISSING_TOKEN', errorMessage: 'Missing token' });
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    // Token resolved (AUTH-102)
    logger.trace('AUTH', 'AUTH-102', ctx, 'Token resolved successfully');

    try {
        const { data: { user }, error } = await supabaseAnon.auth.getUser(token);

        if (error || !user) {
            logger.security('AUTH', 'AUTH-103', ctx, `AUTH_INVALID_TOKEN: ${error?.message || 'User not found'}`);
            authSpan.finish('FAILED', { errorCode: 'AUTH_INVALID_TOKEN', errorMessage: error?.message || 'User not found' });
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Populate req.user
        req.user = { 
            id: user.id,
            email: user.email,
            role: user.role
        };

        // Enriched TraceContext with user details
        req.traceContext = logger.createContext(ctx.correlationId, ctx.runId, req.user);

        // Token verified (AUTH-103)
        logger.trace('AUTH', 'AUTH-103', req.traceContext, 'Token verified via Supabase API');
        authSpan.finish('SUCCESS');
        next();
    } catch (err) {
        logger.error('AUTH', 'AUTH-103', ctx, `AUTH_EXPIRED_TOKEN: ${err.message}`);
        authSpan.finish('FAILED', { errorCode: 'AUTH_EXPIRED_TOKEN', errorMessage: err.message });
        return res.status(401).json({ error: 'Token verification failed' });
    }
};

module.exports = authMiddleware;
