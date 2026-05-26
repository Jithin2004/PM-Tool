const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // googleAuthCallback receives state instead of Bearer token, bypass it here, we will handle it in the controller
    if (req.path === '/oauth2callback') return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // If frontend passes token in query param for /auth/google
        if (req.query.token) {
            const token = req.query.token;
            try {
                const decoded = jwt.decode(token);
                if (decoded && decoded.sub) {
                    req.user = { id: decoded.sub };
                    return next();
                }
            } catch(e){}
        }
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.decode(token);
        if (!decoded || !decoded.sub) {
            return res.status(401).json({ error: 'Invalid token structure' });
        }
        
        req.user = { id: decoded.sub };
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token decoding failed' });
    }
};

module.exports = authMiddleware;
