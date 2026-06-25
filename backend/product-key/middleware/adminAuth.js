module.exports = (req, res, next) => {
    const provided = req.headers["x-license-admin-secret"];

    if (!process.env.LICENSE_ADMIN_SECRET) {
        return res.status(500).json({
            error: "License admin security not configured"
        });
    }

    if (provided !== process.env.LICENSE_ADMIN_SECRET) {
        return res.status(403).json({
            error: "Unauthorized license admin access"
        });
    }

    next();
};
