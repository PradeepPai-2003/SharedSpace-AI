import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Space from '../models/Space.js';
import Message from '../models/Message.js';

import Notification from '../models/Notification.js';
import { getGeminiResponse, getGeminiResponseStream, getAIUser } from '../services/gemini.js';
import crypto from 'crypto';

// In-memory mapping of userId -> Set of socketIds
const userSockets = new Map();

// Rate limiting map: userId -> array of request timestamps
const aiSocketRateLimiters = new Map();
const MAX_AI_REQUESTS_PER_MINUTE = 20;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// Helper to get active socket IDs for a specific user
const getUserSocketIds = (userId) => {
  return userSockets.get(userId.toString()) || new Set();
};

export const setupSockets = (io) => {
  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user._id.toString();
      socket.username = user.username;
      socket.displayName = user.displayName || user.username;
      next();
    } catch (error) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`Socket connected: User ${socket.username} (${userId}), socketId: ${socket.id}`);

    // Track user socket association
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Update user status in MongoDB
    try {
      await User.findByIdAndUpdate(userId, { status: 'online' });
      // Broadcast online status globally
      io.emit('user_online', { userId });
    } catch (error) {
      console.error('Error updating status on connect:', error);
    }

    // --- SPACE ROOM EVENTS ---

    // Join room for a space
    socket.on('join_space', async ({ spaceId } = {}) => {
      if (!spaceId || typeof spaceId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(spaceId)) {
        return socket.emit('error_message', { message: 'Invalid or missing space ID format' });
      }
      try {
        const space = await Space.findById(spaceId);
        if (!space) {
          console.warn(`[DEBUG] Space ${spaceId} not found for socket join`);
          return;
        }
        const isMember = space.members.some((m) => m.user.toString() === userId.toString());
        if (!isMember) {
          console.warn(`[DEBUG] User ${socket.username} is not a member of Space ${spaceId}. Cannot join room.`);
          return;
        }
        socket.join(spaceId);
        console.log(`User ${socket.username} joined space room: ${spaceId}`);
      } catch (err) {
        console.error('Error joining space room:', err);
      }
    });

    // Leave room for a space
    socket.on('leave_space', ({ spaceId } = {}) => {
      if (!spaceId || typeof spaceId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(spaceId)) {
        return socket.emit('error_message', { message: 'Invalid or missing space ID format' });
      }
      socket.leave(spaceId);
      console.log(`User ${socket.username} left space room: ${spaceId}`);
    });

    // --- MESSAGING EVENTS ---

    // Send chat message
    socket.on('send_message', async (payload = {}) => {
      const { spaceId, content, type, fileUrl, fileName, fileSize, replyTo } = payload;
      console.log(`[DEBUG] Server received send_message from User: ${socket.username}, SpaceId: ${spaceId}, Content: ${content}`);
      
      // Reject unexpected fields
      const allowedKeys = ['spaceId', 'content', 'type', 'fileUrl', 'fileName', 'fileSize', 'replyTo'];
      const payloadKeys = Object.keys(payload);
      if (payloadKeys.some(key => !allowedKeys.includes(key))) {
        return socket.emit('error_message', { message: 'Unexpected fields in message payload' });
      }

      // Input Validation
      if (!spaceId || typeof spaceId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(spaceId)) {
        return socket.emit('error_message', { message: 'Invalid or missing space ID format' });
      }
      if (type !== undefined && typeof type !== 'string') {
        return socket.emit('error_message', { message: 'Message type must be a string' });
      }
      const msgType = type || 'text';
      if (msgType === 'text' && (!content || typeof content !== 'string' || content.trim() === '')) {
        return socket.emit('error_message', { message: 'Message content cannot be empty and must be a string' });
      }
      if (content !== undefined && typeof content !== 'string') {
        return socket.emit('error_message', { message: 'Message content must be a string' });
      }
      if (content && content.length > 5000) {
        return socket.emit('error_message', { message: 'Message content cannot exceed 5000 characters' });
      }
      if (fileUrl !== undefined && typeof fileUrl !== 'string') {
        return socket.emit('error_message', { message: 'fileUrl must be a string' });
      }
      if (fileUrl && fileUrl.length > 1000) {
        return socket.emit('error_message', { message: 'fileUrl exceeds maximum length of 1000' });
      }
      if (fileName !== undefined && typeof fileName !== 'string') {
        return socket.emit('error_message', { message: 'fileName must be a string' });
      }
      if (fileName && fileName.length > 255) {
        return socket.emit('error_message', { message: 'fileName exceeds maximum length of 255' });
      }
      if (fileSize !== undefined && fileSize !== null && typeof fileSize !== 'number') {
        return socket.emit('error_message', { message: 'fileSize must be a number' });
      }
      if (replyTo !== undefined && replyTo !== null) {
        if (typeof replyTo !== 'string' || !/^[0-9a-fA-F]{24}$/.test(replyTo)) {
          return socket.emit('error_message', { message: 'Invalid replyTo ID format' });
        }
      }

      try {
        // Find if space has AI enabled
        const space = await Space.findById(spaceId);
        if (!space) {
          console.warn(`[DEBUG] Space ${spaceId} not found for message emission`);
          return socket.emit('error_message', { message: 'Space not found' });
        }

        // Check space membership
        const isMember = space.members.some((m) => m.user.toString() === userId.toString());
        if (!isMember) {
          console.warn(`[DEBUG] User ${socket.username} is not a member of Space ${spaceId}. Blocked message.`);
          return socket.emit('error_message', { message: 'Not authorized to send messages in this space' });
        }

        // 1. Create and save user message
        const messageData = {
          space: spaceId,
          sender: userId,
          content: content || '',
          type: type || 'text',
          fileUrl: fileUrl || '',
          fileName: fileName || '',
          fileSize: fileSize || null,
          readBy: [userId],
        };

        if (replyTo) {
          messageData.replyTo = replyTo;
        }

        let savedMessage = await Message.create(messageData);
        console.log(`[DEBUG] Message saved to MongoDB with ID: ${savedMessage._id}`);
        savedMessage = await Message.findById(savedMessage._id)
          .populate('sender', 'username displayName avatar status')
          .populate({
            path: 'replyTo',
            populate: { path: 'sender', select: 'username displayName' }
          });

        // Update space last activity and clear deletedChatByUsers so the chat reappears for users who hid it
        space.lastActivity = Date.now();
        space.deletedChatByUsers = [];
        await space.save();

        // Broadcast new message to space
        console.log(`[DEBUG] Server broadcasting new_message to room: ${spaceId}, Msg ID: ${savedMessage._id}`);
        io.to(spaceId).emit('new_message', savedMessage);

        // Create database notifications for other space members
        const otherMembers = space.members.filter((m) => m.user.toString() !== userId.toString());
        if (otherMembers.length > 0) {
          (async () => {
            try {
              const notificationsToCreate = [];
              for (const m of otherMembers) {
                // Check if notification already exists for this messageId and user to prevent duplicates
                const exists = await Notification.findOne({
                  user: m.user,
                  'metadata.messageId': savedMessage._id
                });
                if (!exists) {
                  const notifId = new mongoose.Types.ObjectId();
                  notificationsToCreate.push({
                    _id: notifId,
                    user: m.user,
                    type: 'message',
                    title: `New message in ${space.name}`,
                    content: `${socket.displayName}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
                    metadata: { spaceId: space._id, messageId: savedMessage._id },
                  });
                }
              }

              if (notificationsToCreate.length > 0) {
                await Notification.insertMany(notificationsToCreate);
                console.log(`[DEBUG] Created ${notificationsToCreate.length} message notifications in DB`);

                // Emit new_notification over sockets only for the newly created notifications
                notificationsToCreate.forEach((notif) => {
                  const targetSockets = getUserSocketIds(notif.user);
                  targetSockets.forEach((sId) => {
                    io.to(sId).emit('new_notification', {
                      _id: notif._id,
                      type: notif.type,
                      title: notif.title,
                      content: notif.content,
                      metadata: notif.metadata,
                    });
                  });
                });
              }
            } catch (err) {
              console.error('Failed to create/emit space message notifications:', err);
            }
          })();
        }

        // 2. Detect Group AI Mentions (@AI)
        if (space.hasAI && type === 'text' && content && content.includes('@AI')) {
          // Check rate limiting
          const now = Date.now();
          const limitWindowStart = now - RATE_LIMIT_WINDOW;
          let userHistory = aiSocketRateLimiters.get(userId.toString()) || [];
          userHistory = userHistory.filter((timestamp) => timestamp > limitWindowStart);

          if (userHistory.length >= MAX_AI_REQUESTS_PER_MINUTE) {
            // User exceeded rate limit. Post system message.
            const systemErrorMessage = await Message.create({
              space: spaceId,
              sender: userId, // fallback or system representation
              content: 'Too many AI requests. Please wait a minute and try again.',
              type: 'system',
            });
            io.to(spaceId).emit('new_message', systemErrorMessage);
            return;
          }

          userHistory.push(now);
          aiSocketRateLimiters.set(userId.toString(), userHistory);

          // Emit typing indicator for AI assistant (removed to prevent duplicate indicators)

          let aiMessage = null;
          try {
            const bgStart = performance.now();
            console.log(`[PERF] [Socket Mentions] Processing started for Space ID: ${spaceId} at ${new Date().toISOString()}`);

            const member = space.members.find((m) => m.user.toString() === userId.toString());
            const joinedAt = member && member.joinedAt ? member.joinedAt : (space.createdAt || new Date(0));

            // 1. Parallel DB queries: get AI User and appropriate history context
            const dbQueryStart = performance.now();
            const lowerContent = (content || '').toLowerCase();
            
            const fetchHistory = async () => {
              const baseQuery = {
                space: spaceId,
                createdAt: { $gte: joinedAt }
              };
              if (lowerContent.includes('summarize this discussion')) {
                const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
                const queryTime = thirtyMinutesAgo > joinedAt ? thirtyMinutesAgo : joinedAt;
                let msgs = await Message.find({
                  space: spaceId,
                  createdAt: { $gte: queryTime }
                })
                  .sort({ createdAt: -1 })
                  .limit(20)
                  .populate('sender', 'username displayName');
                
                if (msgs.length < 5) {
                  msgs = await Message.find(baseQuery)
                    .sort({ createdAt: -1 })
                    .limit(20)
                    .populate('sender', 'username displayName');
                }
                console.log(`[Socket Mentions] Loaded ${msgs.length} recent messages for 'summarize this discussion'`);
                return msgs;
              } else if (lowerContent.includes('summarize workspace')) {
                const msgs = await Message.find(baseQuery)
                  .sort({ createdAt: -1 })
                  .limit(100)
                  .populate('sender', 'username displayName');
                console.log(`[Socket Mentions] Loaded ${msgs.length} messages for 'summarize workspace'`);
                return msgs;
              } else {
                const msgs = await Message.find(baseQuery)
                  .sort({ createdAt: -1 })
                  .limit(50)
                  .populate('sender', 'username displayName');
                console.log(`[Socket Mentions] Loaded ${msgs.length} messages for general prompt`);
                return msgs;
              }
            };

            const [aiUser, recentMessages] = await Promise.all([
              getAIUser(),
              fetchHistory()
            ]);
            console.log(`[PERF] [Socket Mentions] Initial DB queries took: ${(performance.now() - dbQueryStart).toFixed(2)}ms`);

            // 2. Create streaming placeholder message in the DB
            aiMessage = await Message.create({
              space: spaceId,
              sender: aiUser._id,
              content: '',
              type: 'ai',
              readBy: [aiUser._id],
              isStreaming: true
            });


            const populatedAiMessage = await Message.findById(aiMessage._id)
              .populate('sender', 'username displayName avatar status');

            // 3. Broadcast empty AI bubble immediately to all clients in the room
            io.to(spaceId).emit('new_message', populatedAiMessage);

            const chronologicalHistory = recentMessages.reverse();

            // Format history context for Gemini prompt
            const contextText = chronologicalHistory
              .map((msg) => `${msg.sender ? (msg.sender.displayName || msg.sender.username) : 'AI'}: ${msg.content}`)
              .join('\n');

            const aiSystemInstruction = `You are the AI Assistant inside a group collaboration space named "${space.name}". 
You can see recent space conversation logs to help you understand the context of the chat.
Respond to the latest question or prompt naturally. Address users by their display name if available.
Here is the recent space history context:
\n${contextText}`;

            // Clean the prompt
            const promptText = content.replace(/@AI/g, '').trim();
            console.log(`[SOCKET-AI] User Prompt (raw): "${content}" | Cleaned: "${promptText}"`);
            console.log(`[SOCKET-AI] Initiating getGeminiResponseStream for message placeholder: ${aiMessage._id}`);

            // 4. Call Gemini response stream in the background
            const geminiStart = performance.now();
            let chunkCount = 0;
            const finalResponseText = await getGeminiResponseStream(
              promptText,
              [],
              aiSystemInstruction,
              (chunkText, accumulatedText) => {
                chunkCount++;
                if (chunkCount % 5 === 1) {
                  console.log(`[SOCKET-AI] Stream Chunk #${chunkCount} received. Accumulated length: ${accumulatedText.length}`);
                }
                // Emit chunks to space room
                io.to(spaceId).emit('ai_message_chunk', {
                  spaceId,
                  messageId: aiMessage._id.toString(),
                  fullText: accumulatedText
                });
              }
            );
            console.log(`[PERF] [Socket Mentions] Gemini stream processed in: ${(performance.now() - geminiStart).toFixed(2)}ms`);
            console.log(`[SOCKET-AI] Full Gemini Response Length: ${finalResponseText.length} characters`);

            // 5. Finalize database document and remove isStreaming flag
            const dbSaveStart = performance.now();
            console.log(`[SOCKET-AI] Finalizing AI message in database...`);
            await Message.updateOne(
              { _id: aiMessage._id },
              { content: finalResponseText, isStreaming: false }
            );
            console.log(`[PERF] [Socket Mentions] DB final update took: ${(performance.now() - dbSaveStart).toFixed(2)}ms`);

            // Emit completion event to all clients
            console.log(`[SOCKET-AI] Broadcasting ai_message_complete to room: ${spaceId}`);
            io.to(spaceId).emit('ai_message_complete', {
              spaceId,
              messageId: aiMessage._id.toString(),
              fullText: finalResponseText
            });

            // 6. Create database notifications in background (exclude the prompt initiator to prevent duplicate toasts)
            const otherMembers = space.members.filter((m) => m.user.toString() !== userId.toString());
            if (otherMembers.length > 0) {
              (async () => {
                try {
                  const aiNotifications = [];
                  for (const m of otherMembers) {
                    // Check if notification already exists for this messageId and user to prevent duplicates
                    const exists = await Notification.findOne({
                      user: m.user,
                      'metadata.messageId': aiMessage._id
                    });
                    if (!exists) {
                      const notifId = new mongoose.Types.ObjectId();
                      aiNotifications.push({
                        _id: notifId,
                        user: m.user,
                        type: 'mention',
                        title: `AI Assistant reply in ${space.name}`,
                        content: finalResponseText.substring(0, 50) + (finalResponseText.length > 50 ? '...' : ''),
                        metadata: { spaceId: space._id, messageId: aiMessage._id },
                      });
                    }
                  }

                  if (aiNotifications.length > 0) {
                    await Notification.insertMany(aiNotifications);
                    console.log(`[DEBUG] Created ${aiNotifications.length} AI notifications in DB`);

                    // Emit new_notification over sockets only for newly created notifications
                    aiNotifications.forEach((notif) => {
                      const targetSockets = getUserSocketIds(notif.user);
                      targetSockets.forEach((sId) => {
                        io.to(sId).emit('new_notification', {
                          _id: notif._id,
                          type: notif.type,
                          title: notif.title,
                          content: notif.content,
                          metadata: notif.metadata,
                        });
                      });
                    });
                  }
                } catch (err) {
                  console.error('Failed to create/emit AI notifications:', err);
                }
              })();
            }
          } catch (aiError) {
            console.error('Group AI prompt response failed:', aiError);
            
            if (aiMessage && aiMessage._id) {
              try {
                await Message.updateOne(
                  { _id: aiMessage._id },
                  { content: 'AI Assistant is temporarily unavailable. Please try again.', isStreaming: false }
                );
                io.to(spaceId).emit('ai_message_complete', {
                  spaceId,
                  messageId: aiMessage._id.toString(),
                  fullText: 'AI Assistant is temporarily unavailable. Please try again.'
                });
              } catch (dbErr) {
                console.error('Failed to update AI placeholder error state:', dbErr);
              }
            } else {
              try {
                const systemErrorMessage = await Message.create({
                  space: spaceId,
                  sender: userId, // fallback or system representation
                  content: 'AI Assistant is temporarily unavailable. Please try again.',
                  type: 'system',
                });
                io.to(spaceId).emit('new_message', systemErrorMessage);
              } catch (dbErr) {
                console.error('Failed to create system error message:', dbErr);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error sending message via socket:', error);
        socket.emit('error_message', { message: 'Failed to send message' });
      }
    });

    // --- TYPING INDICATORS ---

    socket.on('typing_start', async ({ spaceId } = {}) => {
      if (!spaceId || typeof spaceId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(spaceId)) return;
      try {
        // Fast-path: check if user is already verified & in the space room
        const inRoom = socket.rooms && socket.rooms.has(spaceId);
        if (!inRoom) {
          const space = await Space.findById(spaceId);
          if (!space) return;
          const isMember = space.members.some((m) => m.user.toString() === userId.toString());
          if (!isMember) return;
        }

        socket.to(spaceId).emit('user_typing', {
          spaceId,
          username: socket.displayName,
          isTyping: true,
        });
      } catch (err) {
        console.error('Error in typing_start socket event:', err);
      }
    });

    socket.on('typing_stop', async ({ spaceId } = {}) => {
      if (!spaceId || typeof spaceId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(spaceId)) return;
      try {
        // Fast-path: check if user is already verified & in the space room
        const inRoom = socket.rooms && socket.rooms.has(spaceId);
        if (!inRoom) {
          const space = await Space.findById(spaceId);
          if (!space) return;
          const isMember = space.members.some((m) => m.user.toString() === userId.toString());
          if (!isMember) return;
        }

        socket.to(spaceId).emit('user_typing', {
          spaceId,
          username: socket.displayName,
          isTyping: false,
        });
      } catch (err) {
        console.error('Error in typing_stop socket event:', err);
      }
    });

    // --- MESSAGE REACTIONS ---

    socket.on('add_reaction', async ({ messageId, emoji } = {}) => {
      if (!messageId || typeof messageId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(messageId)) return;
      if (!emoji || typeof emoji !== 'string' || emoji.length > 10) return;
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        // Fast-path: check if user is already verified & in the space room
        const spaceIdStr = message.space.toString();
        const inRoom = socket.rooms && socket.rooms.has(spaceIdStr);
        if (!inRoom) {
          const space = await Space.findById(message.space);
          if (!space) return;
          const isMember = space.members.some((m) => m.user.toString() === userId.toString());
          if (!isMember) return;
        }

        // Check if reaction emoji already exists
        const reactionIndex = message.reactions.findIndex((r) => r.emoji === emoji);

        if (reactionIndex > -1) {
          // Add user if not already reacted
          if (!message.reactions[reactionIndex].users.includes(userId)) {
            message.reactions[reactionIndex].users.push(userId);
          }
        } else {
          // Add new reaction type
          message.reactions.push({ emoji, users: [userId] });
        }

        await message.save();

        // Broadcast reaction update
        io.to(spaceIdStr).emit('reaction_updated', {
          messageId,
          reactions: message.reactions,
        });
      } catch (err) {
        console.error('Error adding reaction:', err);
      }
    });

    socket.on('remove_reaction', async ({ messageId, emoji } = {}) => {
      if (!messageId || typeof messageId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(messageId)) return;
      if (!emoji || typeof emoji !== 'string' || emoji.length > 10) return;
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        // Fast-path: check if user is already verified & in the space room
        const spaceIdStr = message.space.toString();
        const inRoom = socket.rooms && socket.rooms.has(spaceIdStr);
        if (!inRoom) {
          const space = await Space.findById(message.space);
          if (!space) return;
          const isMember = space.members.some((m) => m.user.toString() === userId.toString());
          if (!isMember) return;
        }

        const reactionIndex = message.reactions.findIndex((r) => r.emoji === emoji);

        if (reactionIndex > -1) {
          // Filter out user from list
          message.reactions[reactionIndex].users = message.reactions[reactionIndex].users.filter(
            (uId) => uId.toString() !== userId
          );

          // Remove reaction object if users list is empty
          if (message.reactions[reactionIndex].users.length === 0) {
            message.reactions.splice(reactionIndex, 1);
          }

          await message.save();

          // Broadcast reaction update
          io.to(spaceIdStr).emit('reaction_updated', {
            messageId,
            reactions: message.reactions,
          });
        }
      } catch (err) {
        console.error('Error removing reaction:', err);
      }
    });


    // --- DISCONNECT ---

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id} (User: ${socket.username})`);
      
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          
          // Set user status offline in DB since no active sockets remain
          try {
            await User.findByIdAndUpdate(userId, {
              status: 'offline',
              lastSeen: Date.now(),
            });
            // Broadcast offline state
            io.emit('user_offline', { userId });

          } catch (error) {
            console.error('Error updating status on disconnect:', error);
          }
        }
      }
    });
  });
};
