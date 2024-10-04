// routes/activity.js

const express = require('express');
const router = express.Router(); // Initialize the router
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const Activity = require('../models/Activity');
const Moment = require('../models/Moment');
const { broadcast } = require('../utils/broadcast'); // Import the broadcast utility

// Configure Multer for comment images
const commentImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/comment-images'); // Ensure this directory exists
  },
  filename: (req, file, cb) => {
    cb(null, `comment_image-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const uploadCommentImage = multer({ storage: commentImageStorage });

// Helper function to send error response
const sendErrorResponse = (res, statusCode, message) => {
  return res.status(statusCode).json({
    status: 'error',
    message,
  });
};

// Middleware to validate moment ID
const validateMomentId = (req, res, next) => {
  const { momentId } = req.body;
  if (!momentId) {
    return sendErrorResponse(res, 400, 'Moment ID is required');
  }
  next();
};

// @route   POST /activity/comment
// @desc    Add a comment with an optional image
// @access  Private
router.post('/activity/comment', authMiddleware, uploadCommentImage.single('comment_image'), async (req, res) => {
  const { momentId, comment } = req.body;
  const userId = req.user.id; // Get userId from JWT

  try {
    // Validate that the moment exists
    const moment = await Moment.findById(momentId);
    if (!moment) {
      return sendErrorResponse(res, 404, 'Moment not found');
    }

    // Create a new comment activity entry
    const activity = new Activity({
      userId,
      momentId,
      type: 'comment',
      comment: comment || null,
      commentImage: req.file ? `${req.protocol}://${req.get('host')}/uploads/comment-images/${req.file.filename}` : null,
    });

    // Save the activity to the database
    await activity.save();

    // Broadcast the new comment to all connected clients
    broadcast({
      type: 'NEW_COMMENT',
      data: activity,
    });

    res.status(200).json({
      status: 'success',
      message: 'Comment added successfully',
      data: activity,
    });
  } catch (err) {
    console.error('Server error:', err.message);
    sendErrorResponse(res, 500, 'Server error');
  }
});

// @route   POST /activity/like
// @desc    Like a moment
// @access  Private
router.post('/activity/like', authMiddleware, validateMomentId, async (req, res) => {
  const { momentId } = req.body;
  const userId = req.user.id; // Get userId from JWT

  try {
    // Validate that the moment exists
    const moment = await Moment.findById(momentId);
    if (!moment) {
      return sendErrorResponse(res, 404, 'Moment not found');
    }

    // Check if the user has already liked this moment
    const existingLike = await Activity.findOne({ userId, momentId, type: 'like' });
    if (existingLike) {
      return sendErrorResponse(res, 400, 'You have already liked this moment');
    }

    // Create a new like activity entry
    const likeActivity = new Activity({
      userId,
      momentId,
      type: 'like',
    });

    // Save the like activity to the database
    await likeActivity.save();

    // Broadcast the new like to all connected clients
    broadcast({
      type: 'NEW_LIKE',
      data: likeActivity,
    });

    res.status(200).json({
      status: 'success',
      message: 'Moment liked successfully',
      data: likeActivity,
    });
  } catch (err) {
    console.error('Server error:', err.message);
    sendErrorResponse(res, 500, 'Server error');
  }
});

// @route   POST /activity/view
// @desc    View a moment
// @access  Private
router.post('/activity/view', authMiddleware, validateMomentId, async (req, res) => {
  const { momentId } = req.body;
  const userId = req.user.id;

  try {
    const moment = await Moment.findById(momentId);
    if (!moment) {
      return sendErrorResponse(res, 404, 'Moment not found');
    }

    const viewActivity = new Activity({ userId, momentId, type: 'view' });
    await viewActivity.save();

    // Broadcast the view activity to all connected clients
    broadcast({
      type: 'NEW_VIEW',
      data: viewActivity,
    });

    res.status(200).json({ status: 'success', message: 'Moment viewed successfully', data: viewActivity });
  } catch (err) {
    console.error('Server error:', err.message);
    sendErrorResponse(res, 500, 'Server error');
  }
});

// @route   POST /activity/share
// @desc    Share a moment
// @access  Private
router.post('/activity/share', authMiddleware, validateMomentId, async (req, res) => {
  const { momentId } = req.body;
  const userId = req.user.id;

  try {
    const moment = await Moment.findById(momentId);
    if (!moment) {
      return sendErrorResponse(res, 404, 'Moment not found');
    }

    const shareActivity = new Activity({ userId, momentId, type: 'share' });
    await shareActivity.save();

    // Broadcast the share activity to all connected clients
    broadcast({
      type: 'NEW_SHARE',
      data: shareActivity,
    });

    res.status(200).json({ status: 'success', message: 'Moment shared successfully', data: shareActivity });
  } catch (err) {
    console.error('Server error:', err.message);
    sendErrorResponse(res, 500, 'Server error');
  }
});

module.exports = router; // Export the router
