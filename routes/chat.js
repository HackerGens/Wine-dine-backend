const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const io = require('../utils/socket'); // WebSocket instance

// @route   POST /api/chat/typing
// @desc    Notify when a user is typing
// @access  Private
router.post('/typing', authMiddleware, (req, res) => {
  const { receiverId } = req.body;
  const senderId = req.user.id;

  if (!receiverId) {
    return res.status(400).json({
      status: 'error',
      message: 'Receiver ID is required'
    });
  }

  io.getIO().emit('typing', {
    senderId,
    receiverId
  });

  res.status(200).json({
    status: 'success',
    message: 'Typing status sent'
  });
});

module.exports = router;
