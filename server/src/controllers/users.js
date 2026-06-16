import User from '../models/User.js';

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-email'); // Exclude email for privacy if viewing another profile
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('GetUserById controller error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving user profile' });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/:id
// @access  Private
export const updateUser = async (req, res) => {
  try {
    // Security check: user can only update their own profile
    if (req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this profile' });
    }

    const { displayName, bio, avatar, status } = req.body;

    const updateFields = {};
    if (displayName !== undefined) updateFields.displayName = displayName;
    if (bio !== undefined) updateFields.bio = bio;
    if (avatar !== undefined) updateFields.avatar = avatar;
    if (status !== undefined) {
      if (!['online', 'offline', 'away'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status value' });
      }
      updateFields.status = status;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('UpdateUser controller error:', error);
    res.status(500).json({ success: false, message: 'Server error updating user profile' });
  }
};

// @desc    Search users by username
// @route   GET /api/users/search
// @access  Private
export const searchUsers = async (req, res) => {
  const { query } = req.query;

  if (!query || query.trim() === '') {
    return res.status(400).json({ success: false, message: 'Search query is required' });
  }

  try {
    // Escape regex operators to prevent ReDoS injection attacks
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

    const users = await User.find({
      username: { $regex: escapedQuery, $options: 'i' },
      _id: { $ne: req.user._id }, // Exclude self
    })
      .select('username displayName avatar status')
      .limit(10);

    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('SearchUsers controller error:', error);
    res.status(500).json({ success: false, message: 'Server error searching users' });
  }
};
