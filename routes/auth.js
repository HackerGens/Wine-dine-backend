const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware'); // Adjusted to match file name

// Load environment variables
require('dotenv').config();

// Helper function to generate RSA key pair
const generateKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  return { publicKey, privateKey };
};

// @route   POST /signup
// @desc    Register a new user
// @access  Public
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

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

    user = new User({ name, email, password });
    user.password = await bcrypt.hash(password, 10);

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

    // Uncomment this if email verification is required
    // if (!user.isVerified) {
    //   return res.status(400).json({
    //     status: 'error',
    //     message: 'Email not verified'
    //   });
    // }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid Credentials'
      });
    }

    // Generate and save public/private keys if not present
    if (!user.publicKey || !user.privateKey) {
      const { publicKey, privateKey } = generateKeyPair();
      user.publicKey = publicKey;
      user.privateKey = privateKey;
      await user.save();
    }

    const payload = { user: { id: user._id, name: user.name, email: user.email } };

    // Set the token to expire in 7 days
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
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
        data: { token, user: payload.user, publicKey: user.publicKey }
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

// Configure Multer for profile image upload
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
router.post('/upload-profile-image', authMiddleware, upload.single('profileImage'), async (req, res) => {
  console.log('Request User:', req.user); // Debugging

  if (!req.file) {
    return res.status(400).json({
      status: 'error',
      message: 'No file uploaded',
    });
  }

  try {
    const user = req.user; // User should be attached by authMiddleware

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

  const user = req.user;

  try {
    if (dob) user.dob = new Date(dob);
    if (userName) user.userName = userName;
    if (liveLocation) user.liveLocation = liveLocation;

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
  const user = req.user;

  try {
    res.status(200).json({
      status: 'success',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
        publicKey: user.publicKey
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

module.exports = router;
