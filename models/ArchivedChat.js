const mongoose = require('mongoose');

const ArchivedChatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  messages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  archivedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ArchivedChat', ArchivedChatSchema);
