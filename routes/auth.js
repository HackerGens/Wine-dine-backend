// routes/auth.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');



// Load environment variables
require('dotenv').config();

// Configure Nodemailer
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// @route   POST /signup
// @desc    Register a new user
// @access  Public
router.post('/signup', async (req, res) => {
    const { name, email, password} = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({
            status: 'error',
            message: 'Please provide all required fields: name, email, and password'
        });
    }

    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({
                status: 'error',
                message: 'User already exists'
            });
        }

        user = new User({ name, email, password});
        user.password = await bcrypt.hash(password, 10);

        // Save the user to the database
        await user.save();

        // Generate a verification code
        const verificationCode = crypto.randomBytes(3).toString('hex').toUpperCase();
        user.verificationCode = verificationCode;
        user.verificationCodeExpires = Date.now() + 3600000; // 1 hour from now
        user.userName = user.name;
        await user.save();

        res.status(200).json({
            status: 'success',
            message: 'User registered successfully. Verification code sent to email'
        });

        // Send the verification code via email
        // const mailOptions = {
        //     from: process.env.EMAIL_USER,
        //     to: email,
        //     subject: 'Your Verification Code',
        //     text: `Your verification code is ${verificationCode}. It will expire in 1 hour.`
        // };

        // transporter.sendMail(mailOptions, (error, info) => {
        //     if (error) {
        //         console.error('Error sending email:', error);
        //         return res.status(500).json({
        //             status: 'error',
        //             message: 'Failed to send verification email'
        //         });
        //     }
        //     res.status(200).json({
        //         status: 'success',
        //         message: 'User registered successfully. Verification code sent to email'
        //     });
        // });
    } catch (err) {
        console.error('Server error:', err.message);
        res.status(500).json({
            status: 'error',
            message: 'Server error'
        });
    }
});

// @route   POST /verify-code
// @desc    Verify the code received by the user
// @access  Public
router.post('/verify-code', async (req, res) => {
    const { email, verificationCode } = req.body;

    if (!email || !verificationCode) {
        return res.status(400).json({
            status: 'error',
            message: 'Email and verification code are required'
        });
    }

    try {
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Check if the code is correct and has not expired
        if (user.verificationCode !== verificationCode || Date.now() > user.verificationCodeExpires) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid or expired verification code'
            });
        }

        // Code is valid, confirm the user's email
        user.isVerified = true;
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        await user.save();

        res.status(200).json({
            status: 'success',
            message: 'Email verified successfully'
        });
    } catch (err) {
        console.error('Server error:', err.message);
        res.status(500).json({
            status: 'error',
            message: 'Server error'
        });
    }
});

// @route   POST /signin
// @desc    Authenticate user & get token
// @access  Public
router.post('/signin', async (req, res) => {
    const { email, password } = req.body;

    try {
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid Credentials'
            });
        }

        // if (!user.isVerified) {
        //     return res.status(400).json({
        //         status: 'error',
        //         message: 'Email not verified'
        //     });
        // }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid Credentials'
            });
        }

        const payload = { user: { id: user.id, name: user.name, email: user.email } };

        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
            if (err) {
                console.error('Token generation error:', err.message);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to generate token'
                });
            }

            res.status(200).json({
                status: 'success',
                message: 'User authenticated successfully',
                data: { token, user: payload.user }
            });
        });
    } catch (err) {
        console.error('Server error:', err.message);
        res.status(500).json({
            status: 'error',
            message: 'Server error'
        });
    }
});

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/profiles-Images');
    },
    filename: (req, file, cb) => {
        cb(null, `avatar-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

// @route   POST /upload-profile-image
// @desc    Upload a profile image and return its URL
// @access  Private (Requires user to be authenticated)
// Upload profile image route
router.post('/upload-profile-image', authMiddleware, upload.single('profileImage'), async (req, res) => {
  if (!req.file) {
      return res.status(400).json({
          status: 'error',
          message: 'No file uploaded',
      });
  }

  try {
      // Extract user from req object (set by authMiddleware)
      const user = req.user;

      // Save the file path or URL in the user's document
      user.profileImageUrl = `${req.protocol}://${req.get('host')}/uploads/profiles-Images/${req.file.filename}`;
      await user.save();

      res.status(200).json({
          status: 'success',
          message: 'Profile image uploaded successfully',
          imageUrl: user.profileImageUrl,
      });
  } catch (err) {
      console.error('Server error:', err.message);
      res.status(500).json({
          status: 'error',
          message: 'Server error',
      });
  }
});

// @route   PATCH /update-profile
// @desc    Update user's profile information
// @access  Private
router.patch('/update-profile', authMiddleware, async (req, res) => {
  const { dob, userName, liveLocation } = req.body;

  // Extract user from req object (set by authMiddleware)
  const user = req.user;

  try {
    // Update fields only if they are provided
    if (dob) user.dob = new Date(dob);
    if (userName) user.userName = userName;
    if (liveLocation) user.liveLocation = liveLocation;

    // Save the updated user information
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        dob: user.dob,
        userName: user.userName,
        liveLocation: user.liveLocation,
      },
    });
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
});

// @route   GET /profile
// @desc    Get profile data of the authenticated user
// @access  Private
router.get('/getProfileData', authMiddleware, async (req, res) => {
  const userId = req.user.id; // Get userId from JWT

  try {
    // Find the user by userId
    const user = await User.findById(userId).select('-password'); // Exclude the password field

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: user,
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
