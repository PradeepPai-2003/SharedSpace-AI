import crypto from 'crypto';
import Space from '../models/Space.js';
import User from '../models/User.js';
import Invite from '../models/Invite.js';
import Message from '../models/Message.js';

// @desc    Create a new space
// @route   POST /api/spaces
// @access  Private
export const createSpace = async (req, res) => {
  const { name, description, isPrivate, hasAI } = req.body;

  try {
    const inviteToken = crypto.randomUUID();

    const space = await Space.create({
      name,
      description: description || '',
      createdBy: req.user._id,
      isPrivate: true,
      hasAI: hasAI !== undefined ? hasAI : true,
      inviteToken,
      members: [
        {
          user: req.user._id,
          role: 'owner',
          joinedAt: new Date(),
        },
      ],
    });

    // Add space reference to user
    await User.findByIdAndUpdate(req.user._id, {
      $push: { spaces: space._id },
    });

    // Create an Invite collection record
    await Invite.create({
      token: inviteToken,
      space: space._id,
      createdBy: req.user._id,
      usageLimit: -1, // Unlimited
      isActive: true,
    });

    res.status(201).json({
      success: true,
      space,
    });
  } catch (error) {
    console.error('CreateSpace controller error:', error);
    res.status(500).json({ success: false, message: 'Server error creating space' });
  }
};

// @desc    Get space details
// @route   GET /api/spaces/:id
// @access  Private
export const getSpace = async (req, res) => {
  try {
    const space = await Space.findById(req.params.id)
      .populate('members.user', 'username displayName avatar status bio lastSeen')
      .populate('createdBy', 'username displayName avatar')
      .populate({
        path: 'pinnedMessages',
        populate: { path: 'sender', select: 'username displayName avatar status' }
      });

    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    // Check if req.user is a member of this space
    const isMember = space.members.some((m) => m.user._id.toString() === req.user._id.toString());
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Access denied. You are not a member of this space.' });
    }

    res.status(200).json({ success: true, space });
  } catch (error) {
    console.error('GetSpace controller error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving space details' });
  }
};

// @desc    Generate/Get invite token for a space
// @route   POST /api/spaces/:id/invite
// @access  Private
export const getInviteLink = async (req, res) => {
  const { usageLimit } = req.body;
  const rawLimit = usageLimit !== undefined ? parseInt(usageLimit) : 5;
  const limit = [5, 10].includes(rawLimit) ? rawLimit : 5; // Only allow 5 or 10

  try {
    const space = await Space.findById(req.params.id);

    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    // Check if user is the workspace owner
    const isOwner = space.createdBy.toString() === req.user._id.toString();
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Only the workspace owner can manage invite links' });
    }

    // Check if an active invite link exists
    let invite = await Invite.findOne({ space: space._id, isActive: true });

    if (invite) {
      // If active invite exists, update set limit if specified
      if (usageLimit !== undefined) {
        invite.usageLimit = limit;
        await invite.save();
      }
    } else {
      const token = crypto.randomUUID();
      invite = await Invite.create({
        token,
        space: space._id,
        createdBy: req.user._id,
        usageLimit: limit,
        isActive: true,
      });

      // Update token in Space schema as well
      space.inviteToken = token;
      await space.save();
    }

    res.status(200).json({
      success: true,
      token: invite.token,
      inviteLink: `/join/${invite.token}`,
      usageLimit: invite.usageLimit,
    });
  } catch (error) {
    console.error('GetInviteLink controller error:', error);
    res.status(500).json({ success: false, message: 'Server error generating invite link' });
  }
};

// @desc    Revoke invite link for a space
// @route   POST /api/spaces/:id/invite/revoke
// @access  Private
export const revokeInviteLink = async (req, res) => {
  try {
    const space = await Space.findById(req.params.id);

    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    // Check if user is the workspace owner
    const isOwner = space.createdBy.toString() === req.user._id.toString();
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Only the workspace owner can revoke invite links' });
    }

    // Mark active invites as inactive
    await Invite.updateMany({ space: space._id, isActive: true }, { isActive: false });

    // Clear token in Space schema
    space.inviteToken = undefined;
    await space.save();

    res.status(200).json({
      success: true,
      message: 'Invite link revoked successfully',
    });
  } catch (error) {
    console.error('RevokeInviteLink controller error:', error);
    res.status(500).json({ success: false, message: 'Server error revoking invite link' });
  }
};

// @desc    Regenerate invite link for a space
// @route   POST /api/spaces/:id/invite/regenerate
// @access  Private
export const regenerateInviteLink = async (req, res) => {
  const { usageLimit } = req.body;
  const rawLimit = usageLimit !== undefined ? parseInt(usageLimit) : 5;
  const limit = [5, 10].includes(rawLimit) ? rawLimit : 5; // Only allow 5 or 10

  try {
    const space = await Space.findById(req.params.id);

    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    // Check if user is the workspace owner
    const isOwner = space.createdBy.toString() === req.user._id.toString();
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Only the workspace owner can regenerate invite links' });
    }

    // Mark current active invites as inactive
    await Invite.updateMany({ space: space._id, isActive: true }, { isActive: false });

    // Generate brand new unique token
    const token = crypto.randomUUID();
    const invite = await Invite.create({
      token,
      space: space._id,
      createdBy: req.user._id,
      usageLimit: limit,
      isActive: true,
    });

    // Update token in Space schema
    space.inviteToken = token;
    await space.save();

    res.status(200).json({
      success: true,
      token: invite.token,
      inviteLink: `/join/${invite.token}`,
      usageLimit: invite.usageLimit,
    });
  } catch (error) {
    console.error('RegenerateInviteLink controller error:', error);
    res.status(500).json({ success: false, message: 'Server error regenerating invite link' });
  }
};

// @desc    Get details of an invite link (Public preview)
// @route   GET /api/spaces/invite/:token
// @access  Public
export const getInviteDetails = async (req, res) => {
  const { token } = req.params;

  try {
    const invite = await Invite.findOne({ token, isActive: true });
    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invalid or inactive invite link' });
    }

    // Check expiry
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      invite.isActive = false;
      await invite.save();
      return res.status(400).json({ success: false, message: 'Invite link has expired' });
    }

    const space = await Space.findById(invite.space)
      .populate('createdBy', 'username displayName avatar')
      .populate('members.user', 'username displayName avatar status');

    if (!space) {
      return res.status(404).json({ success: false, message: 'Space associated with this invite not found' });
    }

    const currentCount = space.members.length;
    const isFull = invite.usageLimit !== -1 && currentCount >= invite.usageLimit;
    const availableSlots = invite.usageLimit === -1 ? -1 : Math.max(0, invite.usageLimit - currentCount);

    res.status(200).json({
      success: true,
      spaceName: space.name,
      ownerName: space.createdBy.displayName || space.createdBy.username,
      members: space.members.map((m) => ({
        username: m.user.username,
        displayName: m.user.displayName,
        avatar: m.user.avatar,
        status: m.user.status,
      })),
      usageLimit: invite.usageLimit,
      currentCount,
      availableSlots,
      isFull,
    });
  } catch (error) {
    console.error('GetInviteDetails controller error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving invite details' });
  }
};

// @desc    Join space using invite token
// @route   POST /api/spaces/join/:token
// @access  Private
export const joinSpace = async (req, res) => {
  const { token } = req.params;

  try {
    // Find active invite
    const invite = await Invite.findOne({ token, isActive: true });

    if (!invite) {
      return res.status(404).json({ success: false, message: 'Invalid or inactive invite link' });
    }

    // Check expiry
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      invite.isActive = false;
      await invite.save();
      return res.status(400).json({ success: false, message: 'Invite link has expired' });
    }

    const space = await Space.findById(invite.space);
    if (!space) {
      return res.status(404).json({ success: false, message: 'Space associated with this invite not found' });
    }

    // Check if already a member
    const isAlreadyMember = space.members.some((m) => m.user.toString() === req.user._id.toString());
    
    if (isAlreadyMember) {
      return res.status(200).json({
        success: true,
        message: 'You are already a member of this space',
        spaceId: space._id,
      });
    }

    // Check member limits!
    const currentMembersCount = space.members.length;
    if (invite.usageLimit !== -1 && currentMembersCount >= invite.usageLimit) {
      return res.status(400).json({ success: false, message: 'Workspace is full. This workspace has reached its member limit.' });
    }

    // Add user to space members list
    space.members.push({
      user: req.user._id,
      role: 'member',
      joinedAt: new Date(),
    });
    await space.save();

    // Add space reference to user profile
    await User.findByIdAndUpdate(req.user._id, {
      $push: { spaces: space._id },
    });

    // Increment invite usage
    invite.usageCount += 1;
    await invite.save();

    // Fetch the populated user to emit to sockets
    const joinedUser = await User.findById(req.user._id).select('username displayName avatar status bio lastSeen');

    // Create system message for space join
    const systemMsg = await Message.create({
      space: space._id,
      sender: joinedUser._id,
      content: `${joinedUser.displayName || joinedUser.username} joined the workspace`,
      type: 'system',
    });

    const populatedSysMsg = await Message.findById(systemMsg._id)
      .populate('sender', 'username displayName avatar status');

    // Broadcast user joined to space room
    const io = req.app.get('socketio');
    if (io) {
      io.to(space._id.toString()).emit('user_joined_space', {
        user: joinedUser,
      });
      io.to(space._id.toString()).emit('new_message', populatedSysMsg);
    }

    res.status(200).json({
      success: true,
      message: 'Successfully joined the space',
      spaceId: space._id,
    });
  } catch (error) {
    console.error('JoinSpace controller error:', error);
    res.status(500).json({ success: false, message: 'Server error joining space' });
  }
};

// @desc    Get user's spaces
// @route   GET /api/spaces
// @access  Private
export const getMySpaces = async (req, res) => {
  try {
    // Find all spaces where the user is a member
    const spaces = await Space.find({
      'members.user': req.user._id
    }).populate('members.user', 'username displayName avatar status');

    res.status(200).json({ success: true, spaces });
  } catch (error) {
    console.error('GetMySpaces controller error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving spaces list' });
  }
};

// @desc    Pin a message in a space
// @route   PUT /api/spaces/:id/pin
// @access  Private
export const pinMessage = async (req, res) => {
  const { id } = req.params;
  const { messageId } = req.body;

  console.log(`[DEBUG] Pin message request received. Space ID: ${id}, Message ID: ${messageId}, User ID: ${req.user._id}`);

  try {
    const space = await Space.findById(id);
    if (!space) {
      console.warn(`[DEBUG] Pin message failed: Space not found for ID ${id}`);
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    // Authorization: only owner, admin, or space creator can pin messages
    const member = space.members.find((m) => m.user.toString() === req.user._id.toString());
    const isOwnerOrAdmin = member && ['owner', 'admin'].includes(member.role);
    const isCreator = space.createdBy.toString() === req.user._id.toString();
    if (!isOwnerOrAdmin && !isCreator) {
      console.warn(`[DEBUG] Pin message denied: User ${req.user._id} is not owner/admin/creator of Space ${id}`);
      return res.status(403).json({ success: false, message: 'Only space owners or admins can pin messages' });
    }

    const message = await Message.findById(messageId);
    if (!message || message.space.toString() !== id) {
      console.warn(`[DEBUG] Pin message failed: Message ID ${messageId} not found in Space ${id}`);
      return res.status(404).json({ success: false, message: 'Message not found in this space' });
    }

    // Check if already pinned
    const isAlreadyPinned = space.pinnedMessages.some((mId) => mId.toString() === messageId.toString());
    if (isAlreadyPinned) {
      console.log(`[DEBUG] Message ${messageId} is already pinned in Space ${id}. Returning populated space.`);
      const populatedSpace = await Space.findById(id)
        .populate('members.user', 'username displayName avatar status bio lastSeen')
        .populate('createdBy', 'username displayName avatar')
        .populate({
          path: 'pinnedMessages',
          populate: { path: 'sender', select: 'username displayName avatar status' }
        });
      return res.status(200).json({ success: true, message: 'Message is already pinned', space: populatedSpace });
    }

    space.pinnedMessages.push(messageId);
    await space.save();
    console.log(`[DEBUG] Message ${messageId} successfully pinned in database for Space ${id}`);

    // Populate pinned message details before broadcasting
    const populatedMessage = await Message.findById(messageId).populate('sender', 'username displayName avatar');

    // Broadcast pinned event to socket room
    const io = req.app.get('socketio');
    if (io) {
      io.to(id).emit('message_pinned', {
        spaceId: id,
        message: populatedMessage,
      });
      console.log(`[DEBUG] Socket event message_pinned emitted to room ${id} for message ${messageId}`);
    } else {
      console.warn(`[DEBUG] Socket.IO instance not found on app, skipping socket emit`);
    }

    const populatedSpace = await Space.findById(id)
      .populate('members.user', 'username displayName avatar status bio lastSeen')
      .populate('createdBy', 'username displayName avatar')
      .populate({
        path: 'pinnedMessages',
        populate: { path: 'sender', select: 'username displayName avatar status' }
      });

    res.status(200).json({ success: true, space: populatedSpace });
  } catch (error) {
    console.error('[DEBUG] PinMessage controller error:', error);
    res.status(500).json({ success: false, message: 'Server error pinning message' });
  }
};

// @desc    Unpin a message in a space
// @route   PUT /api/spaces/:id/unpin
// @access  Private
export const unpinMessage = async (req, res) => {
  const { id } = req.params;
  const { messageId } = req.body;

  console.log(`[DEBUG] Unpin message request received. Space ID: ${id}, Message ID: ${messageId}, User ID: ${req.user._id}`);

  try {
    const space = await Space.findById(id);
    if (!space) {
      console.warn(`[DEBUG] Unpin message failed: Space not found for ID ${id}`);
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    // Authorization: only owner, admin, or space creator can unpin messages
    const member = space.members.find((m) => m.user.toString() === req.user._id.toString());
    const isOwnerOrAdmin = member && ['owner', 'admin'].includes(member.role);
    const isCreator = space.createdBy.toString() === req.user._id.toString();
    if (!isOwnerOrAdmin && !isCreator) {
      console.warn(`[DEBUG] Unpin message denied: User ${req.user._id} is not owner/admin/creator of Space ${id}`);
      return res.status(403).json({ success: false, message: 'Only space owners or admins can unpin messages' });
    }

    space.pinnedMessages = space.pinnedMessages.filter((mId) => mId.toString() !== messageId.toString());
    await space.save();
    console.log(`[DEBUG] Message ${messageId} successfully unpinned in database for Space ${id}`);

    // Broadcast unpinned event
    const io = req.app.get('socketio');
    if (io) {
      io.to(id).emit('message_unpinned', {
        spaceId: id,
        messageId,
      });
      console.log(`[DEBUG] Socket event message_unpinned emitted to room ${id} for message ${messageId}`);
    } else {
      console.warn(`[DEBUG] Socket.IO instance not found on app, skipping socket emit`);
    }

    const populatedSpace = await Space.findById(id)
      .populate('members.user', 'username displayName avatar status bio lastSeen')
      .populate('createdBy', 'username displayName avatar')
      .populate({
        path: 'pinnedMessages',
        populate: { path: 'sender', select: 'username displayName avatar status' }
      });

    res.status(200).json({ success: true, space: populatedSpace });
  } catch (error) {
    console.error('[DEBUG] UnpinMessage controller error:', error);
    res.status(500).json({ success: false, message: 'Server error unpinning message' });
  }
};

// @desc    Leave a space
// @route   POST /api/spaces/:id/leave
// @access  Private
export const leaveSpace = async (req, res) => {
  const { id } = req.params;

  try {
    const space = await Space.findById(id);
    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    // Check if member
    const memberIndex = space.members.findIndex((m) => m.user.toString() === req.user._id.toString());
    if (memberIndex === -1) {
      return res.status(400).json({ success: false, message: 'You are not a member of this space' });
    }

    // Check if owner
    const userMember = space.members[memberIndex];
    const isOwner = userMember && userMember.role === 'owner';
    if (isOwner) {
      // Count how many owners exist in the members list
      const ownerCount = space.members.filter((m) => m.role === 'owner').length;
      if (ownerCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'You are the only owner of this workspace. You must transfer ownership or delete the workspace before leaving.'
        });
      }
    }

    // Remove member
    space.members.splice(memberIndex, 1);
    await space.save();

    // Remove space reference from user
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { spaces: id },
    });

    // Create system message for space leave
    const leftUser = await User.findById(req.user._id).select('username displayName avatar status');
    const systemMsg = await Message.create({
      space: space._id,
      sender: req.user._id,
      content: `${leftUser.displayName || leftUser.username} left the workspace`,
      type: 'system',
    });

    const populatedSysMsg = await Message.findById(systemMsg._id)
      .populate('sender', 'username displayName avatar status');

    // Broadcast user left to space room
    const io = req.app.get('socketio');
    if (io) {
      io.to(space._id.toString()).emit('user_left_space', {
        spaceId: space._id.toString(),
        userId: req.user._id.toString(),
      });
      io.to(space._id.toString()).emit('new_message', populatedSysMsg);
    }

    res.status(200).json({ success: true, message: 'Successfully left the space' });
  } catch (error) {
    console.error('LeaveSpace controller error:', error);
    res.status(500).json({ success: false, message: 'Server error leaving space' });
  }
};

// @desc    Delete space/workspace
// @route   DELETE /api/spaces/:id
// @access  Private
export const deleteSpace = async (req, res) => {
  const { id } = req.params;

  try {
    const space = await Space.findById(id);
    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    // Only owner can delete the workspace
    const isOwner = space.createdBy.toString() === req.user._id.toString();
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Only the workspace owner can delete this workspace' });
    }

    // Delete all messages in the space
    await Message.deleteMany({ space: id });

    // Remove space reference from all users
    await User.updateMany(
      { spaces: id },
      { $pull: { spaces: id } }
    );

    // Delete space document
    await Space.findByIdAndDelete(id);

    // Broadcast deletion to all users in the room so they redirect
    const io = req.app.get('socketio');
    if (io) {
      io.to(id.toString()).emit('workspace_deleted', id);
    }

    res.status(200).json({ success: true, message: 'Workspace deleted successfully' });
  } catch (error) {
    console.error('DeleteSpace controller error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting workspace' });
  }
};
