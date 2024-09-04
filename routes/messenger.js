const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Message = require('../models/Message');
const ArchivedChat = require('../models/ArchivedChat');
const Friend = require('../models/Friend');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/upload'); // For handling image uploads
const { broadcast } = require('../server'); // Import the broadcast function

// Set User Status
router.post('/status/set', authMiddleware, async (req, res) => {
  const { status } = req.body;

  if (!['online', 'offline', 'busy'].includes(status)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid status'
    });
  }

  try {
    const user = await User.findById(req.user.id);
    user.status = status;
    await user.save();

    // Broadcast status change
    broadcast({ type: 'status', userId: req.user.id, status }, req.user.id);

    res.status(200).json({
      status: 'success',
      message: 'Status updated successfully'
    });
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// Typing Indicator
router.post('/chat/typing', authMiddleware, (req, res) => {
  const { receiverId } = req.body;

  if (!receiverId) {
    return res.status(400).json({
      status: 'error',
      message: 'Receiver ID is required'
    });
  }

  broadcast({ type: 'typing', userId: req.user.id }, receiverId);

  res.status(200).json({
    status: 'success',
    message: 'Typing status updated'
  });
});

// Send Scheduled Messages
router.post('/messages/schedule', authMiddleware, async (req, res) => {
  const { receiverId, text, emojis, image, scheduleTime } = req.body;

  if (!receiverId || (!text && !emojis && !image)) {
    return res.status(400).json({
      status: 'error',
      message: 'Receiver ID and at least one message component are required'
    });
  }

  try {
    const currentUser = await User.findById(req.user.id);
    const receiver = await User.findById(receiverId);

    if (currentUser.status === 'busy' || currentUser.status === 'offline') {
      const recentMessages = await Message.find({
        senderId: req.user.id,
        receiverId,
        createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
      });

      if (recentMessages.length >= 1) {
        return res.status(400).json({
          status: 'error',
          message: 'You can only send one message in the last 24 hours while busy or offline'
        });
      }
    }

    const message = new Message({
      senderId: req.user.id,
      receiverId,
      text: text || null,
      emojis: emojis || null,
      image: image || null,
      scheduleTime
    });

    await message.save();

    res.status(200).json({
      status: 'success',
      message: 'Message scheduled successfully'
    });
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// Message Reactions
router.post('/messages/reaction', authMiddleware, async (req, res) => {
  const { messageId, reaction } = req.body;

  try {
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        status: 'error',
        message: 'Message not found'
      });
    }

    message.reactions.push({ userId: req.user.id, reaction });
    await message.save();

    res.status(200).json({
      status: 'success',
      message: 'Reaction added'
    });
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// Get Chat History
router.get('/messages/history', authMiddleware, async (req, res) => {
  const { userId } = req.query;

  try {
    const messages = await Message.find({
      $or: [{ senderId: req.user.id, receiverId: userId }, { senderId: userId, receiverId: req.user.id }]
    });

    res.status(200).json({
      status: 'success',
      data: messages
    });
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// Archive Chat
router.post('/messages/archive', authMiddleware, async (req, res) => {
  const { chatId } = req.body;

  try {
    const archivedChat = await ArchivedChat.create({
      userId: req.user.id,
      chatId
    });

    res.status(200).json({
      status: 'success',
      message: 'Chat archived successfully',
      data: archivedChat
    });
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// Get All Conversations
router.get('/messages/conversations', authMiddleware, async (req, res) => {
  try {
    const conversations = await Message.find({
      $or: [{ senderId: req.user.id }, { receiverId: req.user.id }]
    }).distinct('receiverId');

    res.status(200).json({
      status: 'success',
      data: conversations
    });
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// Send Message to Non-Friends
router.post('/messages/non-friends', authMiddleware, async (req, res) => {
  const { receiverId, text, emojis, image } = req.body;

  if (!receiverId || (!text && !emojis && !image)) {
    return res.status(400).json({
      status: 'error',
      message: 'Receiver ID and at least one message component are required'
    });
  }

  try {
    const currentUser = await User.findById(req.user.id);
    const receiver = await User.findById(receiverId);
    const isFriend = await Friend.exists({ user: req.user.id, friends: receiverId });

    if (!isFriend && (currentUser.status === 'busy' || currentUser.status === 'offline')) {
      const recentMessages = await Message.find({
        senderId: req.user.id,
        receiverId,
        createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
      });

      if (recentMessages.length >= 1) {
        return res.status(400).json({
          status: 'error',
          message: 'You can only send one message in the last 24 hours while busy or offline'
        });
      }
    }

    const message = new Message({
      senderId: req.user.id,
      receiverId,
      text: text || null,
      emojis: emojis || null,
      image: image || null
    });

    await message.save();

    res.status(200).json({
      status: 'success',
      message: 'Message sent successfully'
    });
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = router;
