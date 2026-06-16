import Notification from '../models/Notification.js';

// @desc    Get current user notifications
// @route   GET /api/notifications
// @access  Private
export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50); // Limit to last 50 notifications for performance

    res.status(200).json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error('GetMyNotifications controller error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving notifications' });
  }
};

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // Security check: only own user can mark read
    if (notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this notification' });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error('MarkNotificationRead controller error:', error);
    res.status(500).json({ success: false, message: 'Server error updating notification status' });
  }
};

// @desc    Clear / Delete all notifications for current user
// @route   DELETE /api/notifications
// @access  Private
export const clearMyNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id });
    res.status(200).json({ success: true, message: 'All notifications cleared successfully' });
  } catch (error) {
    console.error('ClearMyNotifications controller error:', error);
    res.status(500).json({ success: false, message: 'Server error clearing notifications' });
  }
};
