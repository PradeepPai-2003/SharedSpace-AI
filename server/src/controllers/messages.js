import Message from '../models/Message.js';
import Space from '../models/Space.js';
import User from '../models/User.js';
import { getGeminiResponse, getGeminiResponseStream, getAIUser } from '../services/gemini.js';
import crypto from 'crypto';

// @desc    Get messages for a space (with pagination)
// @route   GET /api/messages/:spaceId
// @access  Private
export const getMessagesBySpace = async (req, res) => {
  const { spaceId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const before = req.query.before; // ISO date string for loading older messages

  try {
    // Check space access / membership
    const space = await Space.findById(spaceId);
    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    const member = space.members.find((m) => m.user.toString() === req.user._id.toString());
    if (!member) {
      return res.status(403).json({ success: false, message: 'Not authorized to view messages in this space' });
    }
    const joinedAt = member.joinedAt ? member.joinedAt : (space.createdAt || new Date(0));

    // Build query - exclude messages that this user has deleted for themselves or cleared
    const query = { 
      space: spaceId,
      deletedForUsers: { $ne: req.user._id },
      clearedByUsers: { $ne: req.user._id },
      createdAt: { $gte: joinedAt }
    };
    if (before) {
      query.createdAt = { $lt: new Date(before), $gte: joinedAt };
    }

    // Fetch messages sorted by descending creation time (newest first)
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'username displayName avatar status')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'username displayName' }
      });

    // Reverse array to return chronological order (oldest first)
    res.status(200).json({
      success: true,
      messages: messages.reverse(),
    });
  } catch (error) {
    console.error('GetMessagesBySpace controller error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving messages' });
  }
};

// @desc    Delete message (From Me or For Everyone)
// @route   DELETE /api/messages/:id
// @access  Private
export const deleteMessage = async (req, res) => {
  const { type } = req.query; // 'me' or 'everyone'

  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Check space authorization
    const space = await Space.findById(message.space);
    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    // Check if the user is a member of the space
    const userMember = space.members.find((m) => m.user.toString() === req.user._id.toString());
    if (!userMember) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this space' });
    }

    if (type === 'me') {
      // Delete From Me: Add user to deletedForUsers list so it is filtered out for them
      if (!message.deletedForUsers.includes(req.user._id)) {
        message.deletedForUsers.push(req.user._id);
        await message.save();
      }
      return res.status(200).json({ success: true, messageId: message._id, type: 'me' });
    }

    // Delete For Everyone:
    // Authorization check: ONLY the original sender can delete for everyone
    const isSender = message.sender.toString() === req.user._id.toString();

    if (!isSender) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this message for everyone' });
    }

    if (message.isDeleted) {
      return res.status(400).json({ success: false, message: 'Message is already deleted' });
    }

    // Soft delete message content for everyone
    message.isDeleted = true;
    message.content = 'This message was deleted.';
    message.fileUrl = '';
    message.fileName = '';
    message.fileSize = undefined;
    await message.save();

    // Broadcast deletion to all users in the space
    req.app.get('socketio').to(message.space.toString()).emit('message_deleted', message._id);

    return res.status(200).json({ success: true, messageId: message._id, type: 'everyone' });
  } catch (error) {
    console.error('DeleteMessage controller error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting message' });
  }
};

// @desc    Clear space chat history for current user only
// @route   DELETE /api/messages/clear/:spaceId
// @access  Private
export const clearSpaceChat = async (req, res) => {
  const { spaceId } = req.params;

  try {
    const space = await Space.findById(spaceId);
    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    // Verify user is a member of the space
    const isMember = space.members.some((m) => m.user.toString() === req.user._id.toString());
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Not authorized to clear chat in this space' });
    }

    // Add current user to clearedByUsers array for all existing messages in this space
    await Message.updateMany(
      { space: spaceId },
      { $addToSet: { clearedByUsers: req.user._id } }
    );

    res.status(200).json({
      success: true,
      message: 'Chat history cleared successfully',
    });
  } catch (error) {
    console.error('ClearSpaceChat controller error:', error);
    res.status(500).json({ success: false, message: 'Server error clearing chat history' });
  }
};

// @desc    Toggle pin/star message for current user
// @route   PUT /api/messages/:id/pin
// @access  Private
export const togglePinMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const userId = req.user._id;
    // Check if pinnedByUsers array is initialized
    if (!message.pinnedByUsers) {
      message.pinnedByUsers = [];
    }

    const pinnedIndex = message.pinnedByUsers.indexOf(userId);

    if (pinnedIndex > -1) {
      message.pinnedByUsers.splice(pinnedIndex, 1);
    } else {
      message.pinnedByUsers.push(userId);
    }

    await message.save();

    res.status(200).json({
      success: true,
      isPinned: message.pinnedByUsers.includes(userId),
      message
    });
  } catch (error) {
    console.error('TogglePinMessage error:', error);
    res.status(500).json({ success: false, message: 'Server error pinning message' });
  }
};

// @desc    Get user's starred/pinned messages
// @route   GET /api/messages/starred
// @access  Private
export const getStarredMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      pinnedByUsers: req.user._id
    })
    .populate('sender', 'username displayName avatar status')
    .populate('space', 'name'); // Populate space to get name

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error('GetStarredMessages error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving starred messages' });
  }
};

// @desc    Reply to a specific message using AI
// @route   POST /api/messages/:id/reply-with-ai
// @access  Private
export const replyWithAI = async (req, res) => {
  const { id } = req.params;
  const startTime = performance.now();
  console.log(`[PERF] [Reply with AI] Request received for message ID: ${id} at ${new Date().toISOString()}`);

  let originalMessage = null;
  try {
    // 1. Parallelize original message and AI user retrieval
    const dbLookupStart = performance.now();
    const [fetchedMessage, aiUser] = await Promise.all([
      Message.findById(id).populate('sender', 'username displayName'),
      getAIUser()
    ]);
    originalMessage = fetchedMessage;
    const dbLookupEnd = performance.now();
    console.log(`[PERF] [Reply with AI] Initial DB lookups took: ${(dbLookupEnd - dbLookupStart).toFixed(2)}ms`);

    if (!originalMessage) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const spaceId = originalMessage.space;
    const space = await Space.findById(spaceId);
    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    if (!space.hasAI) {
      return res.status(400).json({ success: false, message: 'AI is not enabled in this space' });
    }

    // Check space membership
    const member = space.members.find((m) => m.user.toString() === req.user._id.toString());
    if (!member) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // 2. Get socketio instance
    const io = req.app.get('socketio');

    // 3. Create initial empty AI message in DB (as streaming placeholder)
    const aiMessage = await Message.create({
      space: spaceId,
      sender: aiUser._id,
      content: '',
      type: 'ai',
      replyTo: originalMessage._id,
      readBy: [aiUser._id],
      isStreaming: true
    });

    const populatedAiMessage = await Message.findById(aiMessage._id)
      .populate('sender', 'username displayName avatar status')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'username displayName' }
      });

    // 4. Broadcast AI message placeholder immediately so all clients render it
    io.to(spaceId.toString()).emit('new_message', populatedAiMessage);

    // 5. Send instant 200 response to initiator with the initial placeholder message
    res.status(200).json({ success: true, message: populatedAiMessage });

    const joinedAt = member.joinedAt ? member.joinedAt : (space.createdAt || new Date(0));

    // 6. Handle Gemini streaming in the background
    const recentMessagesStart = performance.now();
    const recentMessages = await Message.find({ 
      space: spaceId,
      deletedForUsers: { $ne: req.user._id },
      clearedByUsers: { $ne: req.user._id },
      createdAt: { $gte: joinedAt }
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('sender', 'username displayName');
    const recentMessagesEnd = performance.now();
    console.log(`[PERF] [Reply with AI] Recent messages query took: ${(recentMessagesEnd - recentMessagesStart).toFixed(2)}ms`);

    const chronologicalHistory = recentMessages.reverse();
    const contextText = chronologicalHistory
      .map((msg) => `${msg.sender ? (msg.sender.displayName || msg.sender.username) : 'AI'}: ${msg.content}`)
      .join('\n');

    const aiSystemInstruction = `You are the AI Assistant inside a group collaboration space named "${space.name}". 
You can see recent space conversation logs to help you understand the context of the chat.
Respond to the selected message as a direct reply. Address users by their display name if available.
Here is the recent space history context:
\n${contextText}`;

    const promptText = `Reply to this message: "${originalMessage.content}" (sent by @${originalMessage.sender?.username || 'User'})`;

    // Process stream in background
    (async () => {
      try {
        const geminiStart = performance.now();
        const finalResponseText = await getGeminiResponseStream(
          promptText,
          [],
          aiSystemInstruction,
          (chunkText, accumulatedText) => {
            // Emit chunk to room
            io.to(spaceId.toString()).emit('ai_message_chunk', {
              spaceId: spaceId.toString(),
              messageId: aiMessage._id.toString(),
              fullText: accumulatedText
            });
          }
        );
        const geminiEnd = performance.now();
        console.log(`[PERF] [Reply with AI] Gemini stream completed in: ${(geminiEnd - geminiStart).toFixed(2)}ms`);

        // Update DB document to finalize content and remove isStreaming flag
        const dbSaveStart = performance.now();
        await Message.updateOne(
          { _id: aiMessage._id },
          { content: finalResponseText, isStreaming: false }
        );
        console.log(`[PERF] [Reply with AI] Final message DB update took: ${(performance.now() - dbSaveStart).toFixed(2)}ms`);

        // Emit complete event to all clients
        io.to(spaceId.toString()).emit('ai_message_complete', {
          spaceId: spaceId.toString(),
          messageId: aiMessage._id.toString(),
          fullText: finalResponseText
        });
      } catch (geminiError) {
        console.error('Gemini streaming error inside replyWithAI:', geminiError);
        
        // Finalize document as error message
        await Message.updateOne(
          { _id: aiMessage._id },
          { content: 'AI Assistant is temporarily unavailable. Please try again.', type: 'system', isStreaming: false }
        );

        io.to(spaceId.toString()).emit('ai_message_complete', {
          spaceId: spaceId.toString(),
          messageId: aiMessage._id.toString(),
          fullText: 'AI Assistant is temporarily unavailable. Please try again.',
          type: 'system'
        });
      }
    })().catch((bgErr) => console.error('Background streaming task wrapper error:', bgErr));

  } catch (error) {
    console.error('replyWithAI controller error:', error);
    const io = req.app.get('socketio');
    const spaceId = originalMessage?.space?.toString();
    if (spaceId) {
      try {
        const systemErrorMessage = await Message.create({
          space: spaceId,
          sender: req.user._id,
          content: 'AI Assistant is temporarily unavailable. Please try again.',
          type: 'system',
        });
        io.to(spaceId).emit('new_message', systemErrorMessage);
      } catch (innerErr) {
        console.error('Failed to create system error message:', innerErr);
      }
    }
    // Only send error status if headers have not been sent yet
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'AI Assistant is temporarily unavailable. Please try again.' });
    }
  }
};
