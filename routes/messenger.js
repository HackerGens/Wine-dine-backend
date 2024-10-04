const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const { encryptMessage } = require('../utils/encrypt');
const { decryptMessage } = require('../utils/decrypt');
const authMiddleware = require('../middleware/authMiddleware');
const cron = require('node-cron');

const router = express.Router();
const server = http.createServer(router);
const wss = new WebSocket.Server({ server });

// Utility function to validate MongoDB Object IDs
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// In-memory store for connected clients
const clients = new Map();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const userId = req.user ? req.user.id : null; // Extract user ID from request if available

  if (userId) {
    clients.set(userId, ws); // Store the connection using userId as the key
    console.log(`User ${userId} connected`);

    ws.on('close', () => {
      clients.delete(userId); // Remove user when connection is closed
      console.log(`User ${userId} disconnected`);
    });
  }

  ws.on('message', (message) => {
    console.log(`Received message from user ${userId}: ${message}`);
    // Handle incoming messages if needed
  });
});

// Broadcast function to send messages to all connected clients
const broadcast = (message) => {
  for (const client of clients.values()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
};

// Schedule a job to run every minute
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();

    // Fetch scheduled messages that need to be sent
    const scheduledMessages = await Message.find({
      scheduledAt: { $lte: now },
      sent: false,
    }).populate('sender recipient');

    for (const message of scheduledMessages) {
      // Decrypt the message text if it's encrypted
      if (message.text) {
        message.text = decryptMessage(message.text, message.sender.publicKey);
      }

      // Send the message
      await sendMessage(message);

      // Update the message to mark it as sent
      message.sent = true;
      await message.save();
    }
  } catch (err) {
    console.error('Error in scheduled message job:', err.message);
  }
});

// Function to send and broadcast the message
async function sendMessage(message) {
  console.log(`Sending message to ${message.recipient._id}: ${message.text}`);
  broadcast({
    type: 'message',
    senderId: message.sender._id,
    receiverId: message.recipient._id,
    text: message.text,
    imageUrl: message.imageUrl,
    emoji: message.emoji,
    scheduledAt: message.scheduledAt,
  });
}

router.post('/messages', authMiddleware, async (req, res) => {
  const { receiverId, text, imageUrl, emoji, messageId, scheduleTime } = req.body;

  if (!receiverId || (!text && !imageUrl && !emoji && !messageId && !scheduleTime)) {
    return res.status(400).json({ status: 'error', message: 'Receiver ID and message content or messageId required' });
  }

  if (!isValidObjectId(receiverId) || (messageId && !isValidObjectId(messageId))) {
    return res.status(400).json({ status: 'error', message: 'Invalid ID format' });
  }

  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ status: 'error', message: 'User authentication failed' });
    }

    const [sender, receiver] = await Promise.all([
      User.findById(req.user.id),
      User.findById(receiverId),
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({ status: 'error', message: 'Sender or receiver not found' });
    }

    let encryptedText = null;
    if (text) {
      if (!receiver.publicKey) {
        return res.status(404).json({ status: 'error', message: 'Receiver public key not found for encryption' });
      }
      encryptedText = encryptMessage(text, receiver.publicKey);
    }

    let message;

    if (scheduleTime) {
      const scheduledDate = new Date(scheduleTime);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Valid schedule time is required' });
      }

      const now = new Date();
      if (scheduledDate < now) {
        return res.status(400).json({ status: 'error', message: 'Scheduled time cannot be in the past' });
      }

      message = new Message({
        sender: req.user.id,
        recipient: receiverId,
        text: encryptedText,
        imageUrl: imageUrl || null,
        emoji: emoji || null,
        scheduledAt: scheduledDate,
        sent: false,
      });

      await message.save();
      return res.status(200).json({ status: 'success', message: 'Message scheduled successfully', data: { message } });
    }

    if (messageId) {
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
      message = new Message({
        sender: req.user.id,
        recipient: receiverId,
        text: encryptedText,
        imageUrl: imageUrl || null,
        emoji: emoji || null,
      });

      await message.save();
      await sendMessage(message); // This now includes the broadcast
    }

    res.status(200).json({
      status: 'success',
      message: messageId ? 'Message updated successfully' : 'Message sent successfully',
      data: {
        message: {
          ...message.toObject(),
          scheduledAt: message.scheduledAt,
          sent: message.sent,
          timestamp: message.timestamp,
        },
      },
    });
  } catch (err) {
    console.error('Error handling message:', err.message);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// Unified route for fetching messages (No WebSocket needed)
router.get('/messages', authMiddleware, async (req, res) => {
  const { userId, messageId, scheduled } = req.query;

  if (!messageId && !userId && !scheduled) {
    return res.status(400).json({ status: 'error', message: 'User ID, message ID, or scheduled parameter required' });
  }

  try {
    let messages;

    if (messageId) {
      messages = await Message.findById(messageId);
      if (!messages) {
        return res.status(404).json({ status: 'error', message: 'Message not found' });
      }
      if (messages.recipient.toString() !== req.user.id && messages.sender.toString() !== req.user.id) {
        return res.status(403).json({ status: 'error', message: 'Unauthorized' });
      }
      if (messages.text) {
        messages.text = decryptMessage(messages.text, req.user.privateKey);
      }
    } else if (scheduled) {
      messages = await Message.find({
        recipient: req.user.id,
        $or: [
          { scheduledAt: { $lte: new Date() } },
          { scheduledAt: null },
        ],
        sent: true,
      }).sort({ scheduledAt: 1 });

      messages = messages.map((msg) => {
        if (msg.text) {
          msg.text = decryptMessage(msg.text, req.user.privateKey);
        }
        return msg;
      });
    } else {
      messages = await Message.find({
        $or: [
          { sender: req.user.id, recipient: userId },
          { sender: userId, recipient: req.user.id },
        ],
        $or: [
          { scheduledAt: { $lte: new Date() } },
          { scheduledAt: null },
        ]
      }).sort({ createdAt: 1 });

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
    return res.status(400).json({ status: 'error', message: 'Valid message IDs are required' });
  }

  try {
    const result = await Message.updateMany(
      { _id: { $in: messageIds }, recipient: req.user.id, read: false },
      { $set: { read: true } }
    );

    res.status(200).json({
      status: 'success',
      message: `${result.nModified} messages marked as read`,
    });
  } catch (err) {
    console.error('Error marking messages as read:', err.message);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

server.listen(3000, () => {
  console.log('Server is listening on port 3000');
});

module.exports = router;