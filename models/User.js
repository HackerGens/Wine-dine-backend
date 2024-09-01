// models/User.js

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please enter your name'], // Custom error message
  },
  email: {
    type: String,
    required: [true, 'Please enter your email'], // Custom error message
    unique: true,
  },
  password: {
    type: String,
    required: [true, 'Please enter your password'], // Custom error message
  },
  date: {
    type: Date,
    default: Date.now,
  },
  isVerified: {
    type: Boolean,
    default: false, // Default to false if the user is not verified
  },
  verificationCode: {
    type: String,
  },
  verificationCodeExpires: {
    type: Date,
  },
  dob: {
    type: Date, // Date of Birth
    default: null,
  },
  userName: {
    type: String, // Username
    default: null,
  },
  liveLocation: {
    type: String, // Live Location
    default: null,
  },
  profileImageUrl: {
    type: String, // Profile Image URL
    default: null,
  },
});

module.exports = mongoose.model('User', UserSchema);
