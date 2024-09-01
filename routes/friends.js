const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Friend = require('../models/Friend');
const User = require('../models/User');

// @route   POST /send-request
// @desc    Send a friend request
// @access  Private
router.post('/send-request', authMiddleware, async (req, res) => {
  const { userId } = req.body; // User to send request to

  if (!userId) {
    return res.status(400).json({
      status: 'error',
      message: 'User ID is required'
    });
  }

  try {
    const currentUserId = req.user.id;

    if (currentUserId === userId) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot send a friend request to yourself'
      });
    }

    // Ensure both users exist
    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId),
      User.findById(userId)
    ]);

    if (!targetUser) {
      return res.status(404).json({
        status: 'error',
        message: 'Target user not found'
      });
    }

    let friendRecord = await Friend.findOne({ user: currentUserId });
    if (!friendRecord) {
      friendRecord = new Friend({ user: currentUserId });
    }

    if (friendRecord.pendingRequests.includes(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Friend request already sent'
      });
    }

    friendRecord.pendingRequests.push(userId);
    await friendRecord.save();

    res.status(200).json({
      status: 'success',
      message: 'Friend request sent successfully'
    });
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   POST /accept-request
// @desc    Accept a friend request
// @access  Private
router.post('/accept-request', authMiddleware, async (req, res) => {
    const { userId } = req.body; // User whose request is being accepted
  
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'User ID is required',
      });
    }
  
    try {
      const currentUserId = req.user.id;
  
      // Find or create Friend document for the current user
      let currentUserRecord = await Friend.findOne({ user: currentUserId });
      if (!currentUserRecord) {
        currentUserRecord = new Friend({
          user: currentUserId,
          pendingRequests: [],
          friends: [],
          blocked: [],
        });
        await currentUserRecord.save();
      }
  
      // Find or create Friend document for the target user
      let targetUserRecord = await Friend.findOne({ user: userId });
      if (!targetUserRecord) {
        targetUserRecord = new Friend({
          user: userId,
          pendingRequests: [],
          friends: [],
          blocked: [],
        });
        await targetUserRecord.save();
      }
  
      // Check if the friend request exists
      if (!currentUserRecord.pendingRequests.includes(userId)) {
        return res.status(400).json({
          status: 'error',
          message: 'No pending friend request from this user',
        });
      }
  
      // Accept the friend request
      currentUserRecord.pendingRequests.pull(userId);
      currentUserRecord.friends.push(userId);
      await currentUserRecord.save();
  
      targetUserRecord.pendingRequests.pull(currentUserId);
      targetUserRecord.friends.push(currentUserId);
      await targetUserRecord.save();
  
      res.status(200).json({
        status: 'success',
        message: 'Friend request accepted',
      });
    } catch (err) {
      console.error('Server error:', err.message);
      res.status(500).json({
        status: 'error',
        message: 'Server error',
      });
    }
  });
  
  
  // @route   GET /users
// @desc    Get all users with full details excluding the current user
// @access  Private
router.get('/allUsers', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Find the current user's Friend record to get blocked users
    const currentUserRecord = await Friend.findOne({ user: currentUserId });
    if (!currentUserRecord) {
      return res.status(404).json({
        status: 'error',
        message: 'User record not found'
      });
    }

    const blockedUsers = currentUserRecord.blockedUsers;

    // Find all users excluding the current user and blocked users
    const users = await User.find({
      _id: { $ne: currentUserId, $nin: blockedUsers }
    }).select('-password');

    if (!users.length) {
      return res.status(404).json({
        status: 'error',
        message: 'No users found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Users retrieved successfully',
      data: users
    });
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

  

// @route   GET /get-all-requests
// @desc    Get all friend requests
// @access  Private
router.get('/get-all-requests', authMiddleware, async (req, res) => {
    try {
      const currentUserId = req.user.id;
  
      // Find the friend document for the current user
      const userRecord = await Friend.findOne({ user: currentUserId })
        .populate('pendingRequests', 'name email profileImageUrl')
        .exec(); // Ensure query execution
  
      if (!userRecord) {
        return res.status(404).json({
          status: 'error',
          message: 'User record not found',
        });
      }
  
      if (userRecord.pendingRequests.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'No pending requests found',
        });
      }
  
      res.status(200).json({
        status: 'success',
        data: userRecord.pendingRequests,
      });
    } catch (err) {
      console.error('Server error:', err.message);
      res.status(500).json({
        status: 'error',
        message: 'Server error',
      });
    }
  });
  
  

// @route   GET /get-all-friends
// @desc    Get all friends of the current user
// @access  Private
router.get('/get-all-friends', authMiddleware, async (req, res) => {
    try {
      const currentUserId = req.user.id;
      
      // Find the current user's Friend record
      const userRecord = await Friend.findOne({ user: currentUserId }).populate({
        path: 'friends',
        select: '-password' // Exclude password field from user details
      });
  
      if (!userRecord) {
        return res.status(404).json({
          status: 'error',
          message: 'User record not found'
        });
      }
  
      // Filter out blocked users from the friends list
      const friendsList = userRecord.friends.filter(friend => 
        !userRecord.blockedUsers.includes(friend._id)
      );
  
      if (friendsList.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'No friends found'
        });
      }
  
      res.status(200).json({
        status: 'success',
        data: friendsList
      });
    } catch (err) {
      console.error('Server error:', err.message);
      res.status(500).json({
        status: 'error',
        message: 'Server error'
      });
    }
  });

// @route   POST /block-friend
// @desc    Block a friend
// @access  Private
router.post('/block-friend', authMiddleware, async (req, res) => {
    const { userId } = req.body;
  
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'User ID is required'
      });
    }
  
    try {
      const currentUserId = req.user.id;
  
      // Find or create Friend document for the current user
      let currentUserRecord = await Friend.findOne({ user: currentUserId });
      if (!currentUserRecord) {
        currentUserRecord = new Friend({
          user: currentUserId,
          pendingRequests: [],
          friends: [],
          blockedUsers: []
        });
      }
  
      // Add to blocked users if not already blocked
      if (!currentUserRecord.blockedUsers.includes(userId)) {
        currentUserRecord.blockedUsers.push(userId);
      }
  
      // Remove from friends and pending requests if they exist
      currentUserRecord.friends.pull(userId);
      currentUserRecord.pendingRequests.pull(userId);
      
      await currentUserRecord.save();
  
      res.status(200).json({
        status: 'success',
        message: 'User blocked successfully'
      });
    } catch (err) {
      console.error('Server error:', err.message, err.stack);
      res.status(500).json({
        status: 'error',
        message: 'Server error'
      });
    }
  });
  
  
  // @route   POST /api/friends/unblock-friend
// @desc    Unblock a friend
// @access  Private
router.post('/unblock-friend', authMiddleware, async (req, res) => {
    const { userId } = req.body;
  
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'User ID is required'
      });
    }
  
    try {
      const currentUserId = req.user.id;
  
      // Find the Friend record for the current user
      let currentUserRecord = await Friend.findOne({ user: currentUserId });
      if (!currentUserRecord) {
        return res.status(404).json({
          status: 'error',
          message: 'User record not found'
        });
      }
  
      // Check if the user is blocked
      if (!currentUserRecord.blockedUsers.includes(userId)) {
        return res.status(400).json({
          status: 'error',
          message: 'User is not blocked'
        });
      }
  
      // Remove user from blocked list
      currentUserRecord.blockedUsers.pull(userId);
  
      // Add user to friends list
      if (!currentUserRecord.friends.includes(userId)) {
        currentUserRecord.friends.push(userId);
      }
  
      // Remove user from pending requests if present
      currentUserRecord.pendingRequests.pull(userId);
  
      await currentUserRecord.save();
  
      res.status(200).json({
        status: 'success',
        message: 'User unblocked and marked as a friend successfully'
      });
    } catch (err) {
      console.error('Server error:', err.message);
      res.status(500).json({
        status: 'error',
        message: 'Server error'
      });
    }
  });

module.exports = router;
