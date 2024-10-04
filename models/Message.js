// models/Message.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,  // Encrypted message stored as a Base64 string
    required: true
  },
  imageUrl: {
    type: String,
    default: null
  },
  emoji: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now  // This field can still be used for message sending time
  },
  createdAt: {  // New field for the message creation time
    type: Date,
    default: Date.now  // Automatically set to the current date and time
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  scheduledAt: {  // New field for scheduled message time
    type: Date,
    default: null  // Set to null if not scheduled
  },
  sent: {  // New field to track if the message has been sent
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Message', MessageSchema);
