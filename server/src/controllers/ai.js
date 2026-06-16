import AIMemory from '../models/AIMemory.js';
import { getGeminiResponse, getGeminiResponseStream, summarizeMemory } from '../services/gemini.js';

// System instruction to guide the AI assistant
const BASE_SYSTEM_INSTRUCTION = `You are a helpful, professional, and friendly AI assistant inside the SharedSpace AI platform. 
Your goal is to collaborate naturally with humans, remember their preferences, and assist them with technical, creative, or general requests.
Keep your answers clear and concise, adapting to the user's tone.`;

// @desc    Send a message to 1-to-1 AI Assistant
// @route   POST /api/ai/chat
// @access  Private
export const chatWithAI = async (req, res) => {
  const { message } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ success: false, message: 'Message content cannot be empty' });
  }

  const startTime = performance.now();
  console.log(`[PERF] [1-on-1 Chat Non-Stream] Request received at: ${new Date().toISOString()}`);

  try {
    // 1. Retrieve the user's AI memory (projected slice -20)
    const memoryStart = performance.now();
    let memory = await AIMemory.findOne(
      { user: req.user._id },
      { messages: { $slice: -20 }, summary: 1, totalMessages: 1 }
    );
    
    if (!memory) {
      memory = await AIMemory.create({
        user: req.user._id,
        messages: [],
        summary: '',
        totalMessages: 0,
      });
    }
    const memoryEnd = performance.now();
    console.log(`[PERF] Memory retrieval took: ${(memoryEnd - memoryStart).toFixed(2)}ms`);

    const contextMessages = memory.messages || [];

    // 2. Compile System Instruction (inject consolidated summary if available)
    let systemInstruction = BASE_SYSTEM_INSTRUCTION;
    if (memory.summary) {
      systemInstruction += `\n\nHere is a summary of what you remember about this user from previous conversations:\n${memory.summary}`;
    }

    // 3. Send request to Gemini service
    const geminiStart = performance.now();
    const aiResponseText = await getGeminiResponse(message, contextMessages, systemInstruction);
    const geminiEnd = performance.now();
    console.log(`[PERF] Gemini API processing completed in: ${(geminiEnd - geminiStart).toFixed(2)}ms`);

    // 4. Update messages log in database (background write)
    const dbSaveStart = performance.now();
    AIMemory.updateOne(
      { user: req.user._id },
      {
        $push: {
          messages: {
            $each: [
              { role: 'user', content: message, timestamp: new Date() },
              { role: 'model', content: aiResponseText, timestamp: new Date() }
            ]
          }
        },
        $inc: { totalMessages: 2 },
        $set: { lastInteraction: new Date() }
      }
    )
      .then(() => {
        const dbSaveEnd = performance.now();
        console.log(`[PERF] Database update took: ${(dbSaveEnd - dbSaveStart).toFixed(2)}ms`);
      })
      .catch((err) => {
        console.error('Background database update error:', err);
      });

    // 5. Asynchronous Memory Consolidation if message count > 100
    if (memory.totalMessages + 2 > 100) {
      triggerMemoryConsolidation(memory._id).catch((err) => {
        console.error('Background memory consolidation failed:', err);
      });
    }

    console.log(`[PERF] Total non-stream controller processing took: ${(performance.now() - startTime).toFixed(2)}ms`);
    
    res.status(200).json({
      success: true,
      reply: aiResponseText,
    });
  } catch (error) {
    console.error('ChatWithAI controller error:', error);
    res.status(500).json({ success: false, message: 'AI failed to respond: ' + error.message });
  }
};

/**
 * Consolidates oldest 50 messages of the AIMemory log into a summary,
 * stores the summary, deletes those 50 messages, and saves the document.
 * 
 * @param {string} memoryId - Database ID of the AIMemory document
 */
const triggerMemoryConsolidation = async (memoryId) => {
  console.log(`Triggering AI memory consolidation for memory ID: ${memoryId}...`);
  const memory = await AIMemory.findById(memoryId);
  if (!memory || memory.messages.length <= 100) return;

  const oldest50 = memory.messages.slice(0, 50);
  const remaining = memory.messages.slice(50);

  // Summarize oldest 50
  const updatedSummary = await summarizeMemory(oldest50, memory.summary);

  // Update DB fields
  memory.summary = updatedSummary;
  memory.messages = remaining;
  await memory.save();
  console.log(`AI memory consolidated successfully for ID: ${memoryId}. Remaining log: ${remaining.length} messages.`);
};

// @desc    Retrieve user's AI memory info
// @route   GET /api/ai/memory/:userId
// @access  Private
export const getAIMemory = async (req, res) => {
  try {
    // Security check
    if (req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this memory profile' });
    }

    const memory = await AIMemory.findOne({ user: req.params.userId });
    if (!memory) {
      return res.status(200).json({
        success: true,
        summary: '',
        totalMessages: 0,
        messages: [],
      });
    }

    res.status(200).json({ success: true, memory });
  } catch (error) {
    console.error('GetAIMemory controller error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching memory info' });
  }
};

// @desc    Clear user's AI memory log
// @route   DELETE /api/ai/memory/:userId
// @access  Private
export const clearAIMemory = async (req, res) => {
  try {
    // Security check
    if (req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this memory profile' });
    }

    const memory = await AIMemory.findOne({ user: req.params.userId });
    if (memory) {
      memory.messages = [];
      memory.summary = '';
      memory.totalMessages = 0;
      await memory.save();
    }

    res.status(200).json({ success: true, message: 'AI memory cleared successfully' });
  } catch (error) {
    console.error('ClearAIMemory controller error:', error);
    res.status(500).json({ success: false, message: 'Server error clearing memory' });
  }
};

// @desc    Send a message to 1-to-1 AI Assistant with response streaming (SSE)
// @route   POST /api/ai/chat/stream
// @access  Private
export const chatWithAIStream = async (req, res) => {
  const { message } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ success: false, message: 'Message content cannot be empty' });
  }

  // Set Server-Sent Events headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const startTime = performance.now();
  console.log(`[PERF] [1-on-1 Chat Stream] Request received at: ${new Date().toISOString()}`);

  try {
    // 1. Memory retrieval time (using projected array slice -20)
    const memoryStart = performance.now();
    let memory = await AIMemory.findOne(
      { user: req.user._id },
      { messages: { $slice: -20 }, summary: 1, totalMessages: 1 }
    );
    
    if (!memory) {
      memory = await AIMemory.create({
        user: req.user._id,
        messages: [],
        summary: '',
        totalMessages: 0,
      });
    }
    const memoryEnd = performance.now();
    console.log(`[PERF] Memory retrieval took: ${(memoryEnd - memoryStart).toFixed(2)}ms`);

        const contextMessages = memory.messages || [];

    // 2. Compile System Instruction
    let systemInstruction = BASE_SYSTEM_INSTRUCTION;
    if (memory.summary) {
      systemInstruction += `\n\nHere is a summary of what you remember about this user from previous conversations:\n${memory.summary}`;
    }

    console.log(`[AI-CHAT] User Prompt: "${message}"`);
    console.log(`[AI-CHAT] Gemini stream call initiated with ${contextMessages.length} history messages`);

    // 3. Gemini streaming request & response
    const geminiStart = performance.now();
    let chunkCount = 0;
    const finalResponseText = await getGeminiResponseStream(
      message,
      contextMessages,
      systemInstruction,
      (chunkText) => {
        chunkCount++;
        console.log(`[AI-CHAT] Stream Chunk #${chunkCount} emitted: "${chunkText.substring(0, 15)}..."`);
        res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
      }
    );
    const geminiEnd = performance.now();
    console.log(`[PERF] Gemini API stream processing completed in: ${(geminiEnd - geminiStart).toFixed(2)}ms`);
    console.log(`[AI-CHAT] Full Gemini Response Length: ${finalResponseText.length} characters`);

    // 4. Update memory log in database (background write)
    const dbSaveStart = performance.now();
    console.log(`[AI-CHAT] Saving AI reply to AIMemory in background...`);
    AIMemory.updateOne(
      { user: req.user._id },
      {
        $push: {
          messages: {
            $each: [
              { role: 'user', content: message, timestamp: new Date() },
              { role: 'model', content: finalResponseText, timestamp: new Date() }
            ]
          }
        },
        $inc: { totalMessages: 2 },
        $set: { lastInteraction: new Date() }
      }
    )
      .then(() => {
        const dbSaveEnd = performance.now();
        console.log(`[PERF] Database update took: ${(dbSaveEnd - dbSaveStart).toFixed(2)}ms`);
      })
      .catch((err) => {
        console.error('Background database update error:', err);
      });

    // 5. Asynchronous Memory Consolidation if total message count > 100
    if (memory.totalMessages + 2 > 100) {
      triggerMemoryConsolidation(memory._id).catch((err) => {
        console.error('Background memory consolidation failed:', err);
      });
    }

    console.log(`[PERF] Total stream controller processing took: ${(performance.now() - startTime).toFixed(2)}ms`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('chatWithAIStream error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
};

