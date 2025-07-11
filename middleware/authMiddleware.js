const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;

        // Optional: Restrict to admins for certain routes
        if (req.path.startsWith('/teachers') && !decoded.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};