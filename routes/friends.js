const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Friend = require('../models/Friend');
const User = require('../models/User');

// Helper function to handle missing user ID in the request
const validateUserId = (userId, res) => {
  if (!userId) {
    res.status(400).json({
      status: 'error',
      message: 'User ID is required',
    });
    return false;
  }
  return true;
};

// @route   POST /send-request
// @desc    Send a friend request
// @access  Private
router.post('/send-request', authMiddleware, async (req, res) => {
  const { userId } = req.body;
  if (!validateUserId(userId, res)) return;

  try {
    const currentUserId = req.user.id;
    if (currentUserId === userId) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot send a friend request to yourself',
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        status: 'error',
        message: 'Target user not found',
      });
    }

    // Check if they are already friends
    const existingFriendship = await Friend.findOne({
      $or: [
        { user: currentUserId, friends: userId },
        { user: userId, friends: currentUserId }
      ]
    });

    if (existingFriendship) {
      return res.status(400).json({
        status: 'error',
        message: 'You are already friends with this user',
      });
    }

    let friendRecord = await Friend.findOne({ user: currentUserId }) || new Friend({ user: currentUserId });

    if (friendRecord.pendingRequests.includes(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Friend request already sent',
      });
    }

    friendRecord.pendingRequests.push(userId);
    await friendRecord.save();

    res.status(200).json({
      status: 'success',
      message: 'Friend request sent successfully',
    });
  } catch (err) {
    console.error('Error sending request:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
});



// @route   POST /accept-request
// @desc    Accept a friend request
// @access  Private
router.post('/accept-request', authMiddleware, async (req, res) => {
  const { userId } = req.body;
  if (!validateUserId(userId, res)) return;

  try {
    const currentUserId = req.user.id;

    let currentUserRecord = await Friend.findOne({ user: currentUserId });
    let targetUserRecord = await Friend.findOne({ user: userId });

    if (!currentUserRecord || !targetUserRecord) {
      return res.status(404).json({
        status: 'error',
        message: 'User record not found',
      });
    }

    if (!currentUserRecord.pendingRequests.includes(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'No pending friend request from this user',
      });
    }

    currentUserRecord.pendingRequests.pull(userId);
    currentUserRecord.friends.push(userId);
    targetUserRecord.friends.push(currentUserId);
    
    await Promise.all([currentUserRecord.save(), targetUserRecord.save()]);

    res.status(200).json({
      status: 'success',
      message: 'Friend request accepted',
    });
  } catch (err) {
    console.error('Error accepting request:', err.message);
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

    const currentUserRecord = await Friend.findOne({ user: currentUserId });
    if (!currentUserRecord) {
      return res.status(404).json({
        status: 'error',
        message: 'User record not found',
      });
    }

    const blockedUsers = currentUserRecord.blockedUsers;
    const users = await User.find({
      _id: { $ne: currentUserId, $nin: blockedUsers },
    }).select('-password');

    if (!users.length) {
      return res.status(404).json({
        status: 'error',
        message: 'No users found',
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Users retrieved successfully',
      data: users,
    });
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
});

// @route   GET /get-all-requests
// @desc    Get all friend requests
// @access  Private
router.get('/get-all-requests', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const userRecord = await Friend.findOne({ user: currentUserId })
      .populate('pendingRequests', 'name email profileImageUrl')
      .exec();

    if (!userRecord || !userRecord.pendingRequests.length) {
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
    console.error('Error fetching requests:', err.message);
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

    const userRecord = await Friend.findOne({ user: currentUserId }).populate({
      path: 'friends',
      select: '-password',
    });

    if (!userRecord || !userRecord.friends.length) {
      return res.status(404).json({
        status: 'error',
        message: 'No friends found',
      });
    }

    const friendsList = userRecord.friends.filter(
      (friend) => !userRecord.blockedUsers.includes(friend._id)
    );

    res.status(200).json({
      status: 'success',
      data: friendsList,
    });
  } catch (err) {
    console.error('Error fetching friends:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
});

// @route   POST /block-friend
// @desc    Block a friend
// @access  Private
router.post('/block-friend', authMiddleware, async (req, res) => {
  const { userId } = req.body;
  if (!validateUserId(userId, res)) return;

  try {
    const currentUserId = req.user.id;

    let currentUserRecord = await Friend.findOne({ user: currentUserId });
    if (!currentUserRecord) {
      currentUserRecord = new Friend({ user: currentUserId });
    }

    if (!currentUserRecord.blockedUsers.includes(userId)) {
      currentUserRecord.blockedUsers.push(userId);
    }

    currentUserRecord.friends.pull(userId);
    currentUserRecord.pendingRequests.pull(userId);
    
    await currentUserRecord.save();

    res.status(200).json({
      status: 'success',
      message: 'User blocked successfully',
    });
  } catch (err) {
    console.error('Error blocking user:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
});

// @route   POST /unblock-friend
// @desc    Unblock a friend
// @access  Private
router.post('/unblock-friend', authMiddleware, async (req, res) => {
  const { userId } = req.body;
  if (!validateUserId(userId, res)) return;

  try {
    const currentUserId = req.user.id;

    let currentUserRecord = await Friend.findOne({ user: currentUserId });
    if (!currentUserRecord) {
      return res.status(404).json({
        status: 'error',
        message: 'User record not found',
      });
    }

    if (!currentUserRecord.blockedUsers.includes(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'User is not blocked',
      });
    }

    currentUserRecord.blockedUsers.pull(userId);
    currentUserRecord.friends.push(userId);
    currentUserRecord.pendingRequests.pull(userId);

    await currentUserRecord.save();

    res.status(200).json({
      status: 'success',
      message: 'User unblocked and marked as a friend successfully',
    });
  } catch (err) {
    console.error('Error unblocking user:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
    });
  }
});

module.exports = router;
