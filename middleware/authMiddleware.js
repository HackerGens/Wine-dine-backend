const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Extract token from Authorization header

    if (!token) {
        return res.status(401).json({
            status: 'error',
            message: 'No token provided',
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.user.id);

        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found',
            });
        }

        req.user = user; // Attach user to req object
        next();
    } catch (err) {
        console.error('Token verification error:', err.message);
        res.status(401).json({
            status: 'error',
            message: 'Invalid token',
        });
    }
};

module.exports = authMiddleware;
