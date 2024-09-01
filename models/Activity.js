const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  momentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Moment',
    required: true,
  },
  type: {
    type: String,
    enum: ['like', 'share', 'comment', 'view'],
    required: true,
  },
  comment: {
    type: String,
    default: null, // Only used if type is 'comment'
  },
  commentImage: {
    type: String,
    default: null, // URL of the comment image
  },
  timestamp: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('Activity', ActivitySchema);
