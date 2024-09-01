// models/Moment.js

const mongoose = require('mongoose');

const MomentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    default: null,
  },
  description: {
    type: String,
    default: null,
  },
  location: {
    type: String,
    default: null,
  },
  latitude: {
    type: Number,
    default: null,
  },
  longitude: {
    type: Number,
    default: null,
  },
  moment_image: {
    type: String,
    required: true, // Required field
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Moment', MomentSchema);
