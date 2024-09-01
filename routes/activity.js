const express = require('express');
const router = express.Router(); // Initialize the router
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const Activity = require('../models/Activity');
const Moment = require('../models/Moment');

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

// @route   POST /activity/comment
// @desc    Add a comment with an optional image
// @access  Private
router.post('/activity/comment', authMiddleware, uploadCommentImage.single('comment_image'), async (req, res) => {
  const { momentId, comment } = req.body;
  const userId = req.user.id; // Get userId from JWT

  if (!momentId) {
    return res.status(400).json({
      status: 'error',
      message: 'Moment ID is required',
    });
  }

  try {
    // Validate that the moment exists
    const moment = await Moment.findById(momentId);
    if (!moment) {
      return res.status(404).json({
        status: 'error',
        message: 'Moment not found',
      });
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

    res.status(200).json({
      status: 'success',
      message: 'Comment added successfully',
      data: activity,
    });
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
});

// @route   POST /activity/like
// @desc    Like a moment
// @access  Private
router.post('/activity/like', authMiddleware, async (req, res) => {
    const { momentId } = req.body;
    const userId = req.user.id; // Get userId from JWT
  
    if (!momentId) {
      return res.status(400).json({
        status: 'error',
        message: 'Moment ID is required',
      });
    }
  
    try {
      // Validate that the moment exists
      const moment = await Moment.findById(momentId);
      if (!moment) {
        return res.status(404).json({
          status: 'error',
          message: 'Moment not found',
        });
      }
  
      // Check if the user has already liked this moment
      const existingLike = await Activity.findOne({ userId, momentId, type: 'like' });
      if (existingLike) {
        return res.status(400).json({
          status: 'error',
          message: 'You have already liked this moment',
        });
      }
  
      // Create a new like activity entry
      const likeActivity = new Activity({
        userId,
        momentId,
        type: 'like',
      });
  
      // Save the like activity to the database
      await likeActivity.save();
  
      res.status(200).json({
        status: 'success',
        message: 'Moment liked successfully',
        data: likeActivity,
      });
    } catch (err) {
      console.error('Server error:', err.message);
      res.status(500).json({
        status: 'error',
        message: 'Server error',
      });
    }
  });

  // View API
router.post('/activity/view', authMiddleware, async (req, res) => {
    const { momentId } = req.body;
    const userId = req.user.id;
  
    if (!momentId) {
      return res.status(400).json({ status: 'error', message: 'Moment ID is required' });
    }
  
    try {
      const moment = await Moment.findById(momentId);
      if (!moment) {
        return res.status(404).json({ status: 'error', message: 'Moment not found' });
      }
  
      const viewActivity = new Activity({ userId, momentId, type: 'view' });
      await viewActivity.save();
  
      res.status(200).json({ status: 'success', message: 'Moment viewed successfully', data: viewActivity });
    } catch (err) {
      console.error('Server error:', err.message);
      res.status(500).json({ status: 'error', message: 'Server error' });
    }
  });
  
  // Share API
  router.post('/activity/share', authMiddleware, async (req, res) => {
    const { momentId } = req.body;
    const userId = req.user.id;
  
    if (!momentId) {
      return res.status(400).json({ status: 'error', message: 'Moment ID is required' });
    }
  
    try {
      const moment = await Moment.findById(momentId);
      if (!moment) {
        return res.status(404).json({ status: 'error', message: 'Moment not found' });
      }
  
      const shareActivity = new Activity({ userId, momentId, type: 'share' });
      await shareActivity.save();
  
      res.status(200).json({ status: 'success', message: 'Moment shared successfully', data: shareActivity });
    } catch (err) {
      console.error('Server error:', err.message);
      res.status(500).json({ status: 'error', message: 'Server error' });
    }
  });

module.exports = router; // Export the router
