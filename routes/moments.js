// routes/moments.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Moment = require('../models/Moment');
const authMiddleware = require('../middleware/authMiddleware'); // Import auth middleware

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/moments-images'); // Ensure this path is correct
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });




// @route   POST /upload-moment
// @desc    Upload a moment
// @access  Private
router.post('/upload-moment', authMiddleware, upload.single('moment_image'), async (req, res) => {
   // console.log('Received file:', req.file); // Debugging log
    const { title, description, location, latitude, longitude } = req.body;
    const userId = req.user.id; // Get userId from JWT
  
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Moment image is required',
      });
    }
  
    try {
      // Create a new moment entry
      const moment = new Moment({
        userId,
        title: title || null,
        description: description || null,
        location: location || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        moment_image: `${req.protocol}://${req.get('host')}/uploads/moments-images/${req.file.filename}`,
      });
  
      // Save the moment to the database
      await moment.save();
  
      res.status(200).json({
        status: 'success',
        message: 'Moment uploaded successfully',
        data: moment,
      });
    } catch (err) {
      console.error('Server error:', err.message);
      res.status(500).json({
        status: 'error',
        message: 'Server error',
      });
    }
  });

  // @route   GET /moments
// @desc    Get all moments with user details
// @access  Public
router.get('/moments', async (req, res) => {
    try {
      // Find all moments and populate user details
      const moments = await Moment.find()
        .populate('userId', 'name userName email profileImageUrl') // Populates userId with user details
        .exec();
  
      res.status(200).json({
        status: 'success',
        data: moments,
      });
    } catch (err) {
      console.error('Server error:', err.message);
      res.status(500).json({
        status: 'error',
        message: 'Server error',
      });
    }
  });


// @route   DELETE /delete-moment/:id
// @desc    Delete a moment by ID
// @access  Private
router.delete('/delete-moment/:id', authMiddleware, async (req, res) => {
    const momentId = req.params.id;
    const userId = req.user.id; // Get userId from JWT
  
    try {
      // Find the moment by ID
      const moment = await Moment.findById(momentId);
      if (!moment) {
        return res.status(404).json({
          status: 'error',
          message: 'Moment not found',
        });
      }
  
      // Check if the moment belongs to the user
      if (moment.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          status: 'error',
          message: 'You are not authorized to delete this moment',
        });
      }
  
      // Delete the moment
      await Moment.findByIdAndDelete(momentId);
  
      res.status(200).json({
        status: 'success',
        message: 'Moment deleted successfully',
      });
    } catch (err) {
      console.error('Server error:', err.message);
      res.status(500).json({
        status: 'error',
        message: 'Server error',
      });
    }
  });


  // @route   GET /my-moments
// @desc    Get all moments of the authenticated user
// @access  Private
router.get('/my-moments', authMiddleware, async (req, res) => {
    const userId = req.user.id; // Get userId from JWT
  
    try {
      // Find all moments for the authenticated user
      const moments = await Moment.find({ userId });
  
      res.status(200).json({
        status: 'success',
        data: moments,
      });
    } catch (err) {
      console.error('Server error:', err.message);
      res.status(500).json({
        status: 'error',
        message: 'Server error',
      });
    }
  });
  

module.exports = router;
