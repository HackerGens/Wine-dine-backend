const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const { broadcast } = require('../utils/broadcast');
const { encryptMessage } = require('../utils/encrypt');
const { decryptMessage } = require('../utils/decrypt');
const authMiddleware = require('../middleware/authMiddleware');

// Utility function to validate MongoDB Object IDs
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Unified route for sending and updating messages
router.post('/messages', authMiddleware, async (req, res) => {
  const { receiverId, text, imageUrl, emoji, messageId } = req.body;

  // Validate input
  if (!receiverId || (!text && !imageUrl && !emoji && !messageId)) {
    return res.status(400).json({ status: 'error', message: 'Receiver ID and message content or messageId required' });
  }

  if (!isValidObjectId(receiverId) || (messageId && !isValidObjectId(messageId))) {
    return res.status(400).json({ status: 'error', message: 'Invalid ID format' });
  }

  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ status: 'error', message: 'User authentication failed' });
    }

    // Fetch sender and receiver
    const [sender, receiver] = await Promise.all([
      User.findById(req.user.id),
      User.findById(receiverId)
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({ status: 'error', message: 'Sender or receiver not found' });
    }

    // Encrypt the message text if provided
    let encryptedText = null;
    if (text) {
      if (!receiver.publicKey) {
        return res.status(404).json({ status: 'error', message: 'Receiver public key not found for encryption' });
      }
      encryptedText = encryptMessage(text, receiver.publicKey);
    }

    let message;
    if (messageId) {
      // Update existing message
      message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ status: 'error', message: 'Message not found' });
      }
      if (message.sender.toString() !== req.user.id) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized' });
      }

      message.text = encryptedText || message.text;
      message.imageUrl = imageUrl || message.imageUrl;
      message.emoji = emoji || message.emoji;
      await message.save();
    } else {
      // Create a new message
      message = new Message({
        sender: req.user.id,
        recipient: receiverId,
        text: encryptedText,
        imageUrl: imageUrl || null,
        emoji: emoji || null,
      });

      await message.save();

      // Broadcast the message to WebSocket clients
      broadcast({
        type: 'message',
        senderId: req.user.id,
        receiverId,
        text: encryptedText,
        imageUrl,
        emoji,
      });
    }

    res.status(200).json({
      status: 'success',
      message: messageId ? 'Message updated successfully' : 'Message sent successfully',
      data: { message },
    });
  } catch (err) {
    console.error('Error handling message:', err.message);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// Unified route for fetching messages
router.get('/messages', authMiddleware, async (req, res) => {
  const { userId, messageId } = req.query;

  if (!messageId && !userId) {
    return res.status(400).json({ status: 'error', message: 'User ID or message ID required' });
  }

  try {
    let messages;
    if (messageId) {
      // Fetch specific message
      messages = await Message.findById(messageId);
      if (!messages) {
        return res.status(404).json({ status: 'error', message: 'Message not found' });
      }
      if (messages.recipient.toString() !== req.user.id && messages.sender.toString() !== req.user.id) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized' });
      }
      // Decrypt the message text if encrypted
      if (messages.text) {
        messages.text = decryptMessage(messages.text, req.user.privateKey);
      }
    } else {
      // Fetch conversation history
      messages = await Message.find({
        $or: [
          { sender: req.user.id, recipient: userId },
          { sender: userId, recipient: req.user.id },
        ],
      }).sort({ createdAt: 1 });

      // Decrypt messages before sending them back
      messages = messages.map((msg) => {
        if (msg.text) {
          msg.text = decryptMessage(msg.text, req.user.privateKey);
        }
        return msg;
      });
    }

    res.status(200).json({
      status: 'success',
      data: messages,
    });
  } catch (err) {
    console.error('Error fetching messages:', err.message);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// PUT route to mark messages as read
router.put('/messages/read', authMiddleware, async (req, res) => {
  const { messageIds } = req.body;

  if (!messageIds || !Array.isArray(messageIds)) {
    return res.status(400).json({ status: 'error', message: 'Message IDs required' });
  }

  try {
    await Message.updateMany(
      { _id: { $in: messageIds }, recipient: req.user.id },
      { $set: { read: true } }
    );

    res.status(200).json({
      status: 'success',
      message: 'Messages marked as read',
    });
  } catch (err) {
    console.error('Error marking messages as read:', err.message);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// DELETE route to delete messages
router.delete('/messages/delete/:messageId', authMiddleware, async (req, res) => {
  const { messageId } = req.params;

  if (!isValidObjectId(messageId)) {
    return res.status(400).json({ status: 'error', message: 'Invalid message ID' });
  }

  try {
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ status: 'error', message: 'Message not found' });
    }

    // Only the sender or recipient can delete the message
    if (message.sender.toString() !== req.user.id && message.recipient.toString() !== req.user.id) {
      return res.status(403).json({ status: 'error', message: 'Unauthorized' });
    }

    await message.remove();

    res.status(200).json({
      status: 'success',
      message: 'Message deleted',
    });
  } catch (err) {
    console.error('Error deleting message:', err.message);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

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

  // Validate input
  if (!receiverId || (!text && !emojis && !image)) {
    return res.status(400).json({
      status: 'error',
      message: 'Receiver ID and at least one message component are required'
    });
  }

  if (!isValidObjectId(receiverId)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid receiver ID format'
    });
  }

  if (!scheduleTime || new Date(scheduleTime) <= new Date()) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid schedule time. Must be a future date'
    });
  }

  try {
    // Fetch current user and recipient
    const [currentUser, recipientUser] = await Promise.all([
      User.findById(req.user.id),
      User.findById(receiverId)
    ]);

    if (!currentUser) {
      return res.status(404).json({
        status: 'error',
        message: 'Current user not found'
      });
    }

    if (!recipientUser) {
      return res.status(404).json({
        status: 'error',
        message: 'Recipient not found'
      });
    }

    // Encrypt the message text if provided
    const encryptedText = text ? encryptMessage(text, recipientUser.publicKey) : null;

    // Save scheduled message
    const scheduledMessage = new Message({
      sender: req.user.id,
      recipient: receiverId,
      text: encryptedText,
      imageUrl: image || null,
      emoji: emojis || null,
      scheduleTime
    });

    await scheduledMessage.save();

    // Optionally, implement logic to handle scheduled message sending

    res.status(200).json({
      status: 'success',
      message: 'Message scheduled successfully'
    });
  } catch (err) {
    console.error('Error scheduling message:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});


module.exports = router;
