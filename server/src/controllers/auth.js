import User from '../models/User.js';
import AIMemory from '../models/AIMemory.js';
import jwt from 'jsonwebtoken';

// Helper to generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Check if user already exists
    const userExists = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
    });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: userExists.email === email.toLowerCase()
          ? 'Email is already registered'
          : 'Username is already taken',
      });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
    });

    // Initialize AIMemory record for this user
    await AIMemory.create({
      user: user._id,
      messages: [],
      summary: '',
      totalMessages: 0,
    });

    // Generate token
    const token = generateToken(user._id);

    // Prepare response user object (remove password)
    const userResponse = {
      _id: user._id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
      status: user.status,
      spaces: user.spaces,
      isVerified: user.isVerified,
    };

    res.status(201).json({
      success: true,
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error('Registration controller error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email and explicitly include password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Match password
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id);

    // Update status to online (will be double confirmed via socket connection)
    user.status = 'online';
    await user.save();

    // Prepare response user object (without password)
    const userResponse = {
      _id: user._id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
      status: user.status,
      spaces: user.spaces,
      isVerified: user.isVerified,
    };

    res.status(200).json({
      success: true,
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error('Login controller error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

// @desc    Logout user & set status offline
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  try {
    // Set status to offline on logout
    if (req.user) {
      const user = await User.findById(req.user._id);
      if (user) {
        user.status = 'offline';
        user.lastSeen = Date.now();
        await user.save();
      }
    }
    res.status(200).json({ success: true, message: 'User logged out successfully' });
  } catch (error) {
    console.error('Logout controller error:', error);
    res.status(500).json({ success: false, message: 'Server error during logout' });
  }
};

// @desc    Get currently logged in user info
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    // req.user is populated by protect middleware
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('GetMe controller error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving user info' });
  }
};
