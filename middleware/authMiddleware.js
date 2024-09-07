// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  console.log('Token:', token); // Debugging line

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Access denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded Token:', decoded); // Debugging line
    const user = await User.findById(decoded.user.id);

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'User not found' });
    }

    req.user = user; // Attach user to request
    next();
  } catch (err) {
    console.error('JWT verification error:', err.message);
    res.status(401).json({ status: 'error', message: 'Invalid token' });
  }
};

module.exports = authMiddleware;
