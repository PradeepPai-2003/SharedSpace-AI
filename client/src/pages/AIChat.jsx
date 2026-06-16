import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../stores/authStore';
import { useMessageStore } from '../stores/messageStore';
import { useUiStore } from '../stores/uiStore';
import { Bot, Send, Trash2, ShieldAlert, Sparkles, BrainCircuit, MessageSquare, AlertCircle, ArrowLeft, X } from 'lucide-react';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';

const TypingDots = () => {
  const [dotsCount, setDotsCount] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotsCount((prev) => (prev % 3) + 1);
    }, 333);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5 py-2 px-1 select-none min-h-[24px]">
      <span className="w-2 h-2 rounded-full bg-accent-ai transition-opacity duration-300" style={{ opacity: dotsCount >= 1 ? 1 : 0 }} />
      <span className="w-2 h-2 rounded-full bg-accent-ai transition-opacity duration-300" style={{ opacity: dotsCount >= 2 ? 1 : 0 }} />
      <span className="w-2 h-2 rounded-full bg-accent-ai transition-opacity duration-300" style={{ opacity: dotsCount >= 3 ? 1 : 0 }} />
    </div>
  );
};

const AIChat = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (location.state && location.state.from) {
      navigate(location.state.from);
    } else if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  const { user } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
    }))
  );
  const { aiChatHistory, aiLoading, fetchAIChatHistory, sendMessageToAI, clearAIChatHistory } = useMessageStore(
    useShallow((state) => ({
      aiChatHistory: state.aiChatHistory,
      aiLoading: state.aiLoading,
      fetchAIChatHistory: state.fetchAIChatHistory,
      sendMessageToAI: state.sendMessageToAI,
      clearAIChatHistory: state.clearAIChatHistory,
    }))
  );
  const { addNotification } = useUiStore(
    useShallow((state) => ({
      addNotification: state.addNotification,
    }))
  );

  const [promptText, setPromptText] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch history and memory summary on mount
  useEffect(() => {
    if (user?._id) {
      fetchAIChatHistory(user._id);
      fetchMemorySummary();
    }
  }, [user?._id, fetchAIChatHistory]);

  // Scroll to bottom when new AI messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [aiChatHistory, aiLoading]);

  // Fetch memory summary details
  const fetchMemorySummary = async () => {
    try {
      const res = await api.get(`/ai/memory/${user._id}`);
      setAiSummary(res.data.memory?.summary || '');
    } catch (err) {
      console.warn('Failed to retrieve AI memory details:', err);
    }
  };

  const handleInputChange = (e) => {
    setPromptText(e.target.value);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt(e);
    }
  };

  // Handle Send Prompt
  const handleSendPrompt = async (e) => {
    if (e) e.preventDefault();
    if (!promptText.trim() || aiLoading) return;

    const queryText = promptText;
    setPromptText('');

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    const res = await sendMessageToAI(queryText);
    if (res.success) {
      // Refresh memory summary in case background consolidation was triggered
      fetchMemorySummary();
    } else {
      addNotification('error', 'AI Failed to Respond', res.error);
    }
    inputRef.current?.focus();
  };

  // Handle Clear Memory
  const handleClearMemorySubmit = async () => {
    setClearing(true);
    const res = await clearAIChatHistory(user._id);
    setClearing(false);
    setShowClearModal(false);

    if (res.success) {
      setAiSummary('');
      setMemoryOpen(false);
      addNotification('success', 'AI Memory Reset', 'AI conversation history and persistent summary have been cleared.');
    } else {
      addNotification('error', 'Reset Failed', res.error);
    }
  };

  const renderMemoryContent = () => (
    <>
      <div className="flex-grow overflow-y-auto p-5 flex flex-col gap-6 scroll-gpu">
        <div>
          <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">How Memory Works</h4>
          <p className="text-[11px] text-text-muted leading-relaxed">
            SharedSpace AI Assistant maintains long-term persistent memory across chat sessions. Once your logs exceed 100 messages, older messages are consolidated into a high-density memory summary, keeping prompt responses fast and context-aware.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Consolidated Summary</h4>
          {aiSummary ? (
            <div className="bg-background-secondary p-4 rounded-2xl border border-accent-ai/20 shadow-md">
              <p className="text-[11px] text-text-primary leading-relaxed italic">
                "{aiSummary}"
              </p>
            </div>
          ) : (
            <div className="bg-background-secondary/40 p-4 rounded-2xl border border-border-primary/50 text-[11px] text-text-muted italic leading-relaxed">
              No consolidated history yet. AI will generate summaries as you interact more.
            </div>
          )}
        </div>
      </div>

      {/* Clear Memory Trigger */}
      <div className="p-4 border-t border-border-primary text-center">
        <button
          onClick={() => setShowClearModal(true)}
          className="w-full py-2.5 bg-danger/10 hover:bg-danger/25 border border-danger/20 text-danger rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Trash2 className="w-4 h-4" /> Clear Memory Log
        </button>
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="flex-grow flex h-full overflow-hidden bg-background-primary relative font-sans"
    >
      
      {/* Background glow orb */}
      <div className="absolute top-[10%] right-[-10%] w-[35%] aspect-square rounded-full bg-accent-ai/5 blur-[120px] pointer-events-none" />

      {/* Mobile/Tablet Left Panel Drawer */}
      <AnimatePresence>
        {memoryOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setMemoryOpen(false)}
              className="fixed inset-0 bg-black/60 z-[150] backdrop-blur-sm lg:hidden"
            />
            {/* Drawer container */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 bottom-0 left-0 w-[300px] max-w-[85vw] bg-background-secondary border-r border-border-primary flex flex-col z-[160] lg:hidden h-full shadow-2xl"
            >
              <div className="p-5 border-b border-border-primary flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-accent-ai animate-pulse" />
                  <span className="text-sm font-bold text-text-primary tracking-tight">AI Persistent Memory</span>
                </div>
                <button
                  onClick={() => setMemoryOpen(false)}
                  className="p-1.5 rounded-lg bg-background-elevated hover:bg-background-elevated/80 text-text-primary border border-border-primary cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4 text-text-secondary hover:text-text-primary" />
                </button>
              </div>
              
              {renderMemoryContent()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 1. LEFT PANEL (Desktop): AI Memory details (visible on lg screens, 300px wide) */}
      <div className="hidden lg:flex flex-col w-[300px] bg-background-secondary/35 border-r border-border-primary flex-shrink-0">
        <div className="p-5 border-b border-border-primary flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-accent-ai animate-pulse" />
          <span className="text-sm font-bold text-text-primary tracking-tight">AI Persistent Memory</span>
        </div>
        {renderMemoryContent()}
      </div>

      {/* 2. RIGHT PANEL: Chat Workspace */}
      <div className="flex-grow flex flex-col min-w-0 h-full relative">
        
        {/* Header */}
        <div className="h-16 border-b border-border-primary bg-background-secondary/20 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-2 md:gap-4 min-w-0 w-full justify-between sm:justify-start">
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              {/* Back Button */}
              <motion.button
                onClick={handleBack}
                whileHover={{ scale: 1.05, boxShadow: "0px 0px 10px rgba(45, 212, 191, 0.2)" }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background-elevated hover:bg-background-elevated/85 text-text-primary border border-border-primary text-xs font-semibold cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-accent-ai" />
                <span>Back</span>
              </motion.button>

              {/* Memory Button (hidden on >= 1024px) */}
              <motion.button
                onClick={() => setMemoryOpen(true)}
                whileHover={{ scale: 1.05, boxShadow: "0px 0px 10px rgba(45, 212, 191, 0.2)" }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background-elevated hover:bg-background-elevated/85 text-text-primary border border-border-primary text-xs font-semibold cursor-pointer transition-colors"
              >
                <BrainCircuit className="w-4 h-4 text-accent-ai animate-pulse" />
                <span>Memory</span>
              </motion.button>
            </div>

            <div className="h-6 w-[1px] bg-border-primary hidden sm:block flex-shrink-0" />

            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-accent-ai/10 border border-accent-ai/30 flex items-center justify-center animate-orb flex-shrink-0">
                <Bot className="w-4 h-4 text-accent-ai" />
              </div>
              <div className="min-w-0">
                {/* Breadcrumb & Title */}
                <p className="text-[10px] text-text-muted hidden md:block mb-0.5">
                  {location.state?.from?.includes('/space') ? 'Workspace' : 'Dashboard'} &gt; AI Assistant
                </p>
                <h2 className="text-sm md:text-base font-bold text-text-primary leading-none truncate">1-on-1 AI Assistant</h2>
              </div>
            </div>
          </div>
        </div>

        {/* Persistent Memory Banner */}
        {aiSummary && (
          <div className="bg-accent-ai/10 border-b border-accent-ai/20 px-6 py-2.5 flex items-center gap-2 flex-shrink-0 animate-fade-in">
            <Sparkles className="w-4 h-4 text-accent-ai animate-pulse" />
            <span className="text-[10px] md:text-xs text-accent-ai font-medium">
              AI remembers you from previous conversations
            </span>
          </div>
        )}

        {/* Conversation Stream */}
        <div className="flex-grow overflow-y-auto px-6 py-6 flex flex-col gap-4 scroll-gpu">
          {aiChatHistory.length === 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center text-center gap-3">
              {/* Pulse glowing orb */}
              <div className="w-20 h-20 rounded-full bg-accent-ai/10 border-2 border-accent-ai flex items-center justify-center text-accent-ai animate-orb">
                <Bot className="w-10 h-10" />
              </div>
              <h4 className="text-base font-extrabold text-text-primary">Chat with SharedSpace AI</h4>
              <p className="text-xs text-text-secondary max-w-sm">
                Ask questions, draft text, brainstorm ideas, or debug code. AI retains persistent memories of your conversations.
              </p>
            </div>
          ) : (
            aiChatHistory.map((msg, index) => {
              const isMe = msg.role === 'user';
              return (
                <div
                  key={index}
                  className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-text-secondary">
                      {isMe ? 'You' : 'AI Assistant'}
                    </span>
                    {msg.timestamp && (
                      <span className="text-[9px] text-text-muted">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  <div
                    className={`p-3.5 rounded-2xl shadow-md ${
                      isMe
                        ? 'bg-accent-primary text-white rounded-tr-none'
                        : 'bg-gradient-to-tr from-background-secondary to-background-secondary/90 border border-border-primary text-text-primary rounded-tl-none'
                    }`}
                  >
                    {(!msg.content || msg.content.trim() === '') && msg.isStreaming ? (
                      <TypingDots />
                    ) : (
                      <p className="text-xs md:text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {msg.content}
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-3.5 ml-1 bg-accent-ai animate-pulse rounded-sm align-middle" />
                        )}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input panel */}
        <div className="p-2.5 sm:p-4 bg-background-secondary/20 border-t border-border-primary flex-shrink-0">
          <form onSubmit={handleSendPrompt} className="flex gap-2 sm:gap-3 items-center">
            <div className="flex-grow relative">
              <textarea
                ref={inputRef}
                required
                value={promptText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={aiLoading ? 'AI assistant is thinking...' : 'Ask AI anything...'}
                disabled={aiLoading}
                rows={1}
                className="w-full bg-background-primary border border-border-primary rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary resize-none overflow-y-auto max-h-32 min-h-[44px] sm:min-h-[46px] leading-relaxed"
              />
            </div>
            <button
              type="submit"
              disabled={aiLoading || !promptText.trim()}
              className="flex-shrink-0 w-11 h-11 bg-accent-ai hover:bg-accent-ai/90 disabled:bg-accent-ai/50 text-white rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center border-none cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>

      </div>

      {/* CLEAR AI MEMORY CONFIRMATION MODAL */}
      {showClearModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background-secondary border border-border-primary rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl relative scale-in-call text-center flex flex-col items-center">
            <div className="w-12 h-12 bg-danger/10 text-danger rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-text-primary">Reset AI Assistant Memory?</h3>
            <p className="text-xs text-text-secondary mt-2 leading-relaxed">
              This action will permanently delete all chat history logs and wipe out the consolidated context summary. This cannot be undone.
            </p>

            <div className="flex gap-4 mt-6 w-full">
              <button
                onClick={() => setShowClearModal(false)}
                className="flex-1 py-2.5 bg-background-elevated hover:bg-background-elevated/80 rounded-xl text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleClearMemorySubmit}
                disabled={clearing}
                className="flex-1 py-2.5 bg-danger hover:bg-danger/80 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-danger/10"
              >
                {clearing ? 'Clearing...' : 'Clear Memory'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .scale-in-call {
          animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </motion.div>
  );
};

export default AIChat;
