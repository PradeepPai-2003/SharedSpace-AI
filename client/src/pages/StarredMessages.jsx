import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useMessageStore } from '../stores/messageStore';
import { useSpaceStore } from '../stores/spaceStore';
import { Star, MessageSquare, ArrowLeft, Trash2, Calendar, FileText, FileSpreadsheet, FileArchive, Play } from 'lucide-react';
import MediaViewer from '../components/MediaViewer';

const StarredMessages = () => {
  const navigate = useNavigate();
  const { starredMessages, fetchStarredMessages, togglePinMessage } = useMessageStore(
    useShallow((state) => ({
      starredMessages: state.starredMessages,
      fetchStarredMessages: state.fetchStarredMessages,
      togglePinMessage: state.togglePinMessage,
    }))
  );
  const { clearCurrentSpace } = useSpaceStore(
    useShallow((state) => ({
      clearCurrentSpace: state.clearCurrentSpace,
    }))
  );

  const [activeMediaViewer, setActiveMediaViewer] = useState(null);

  // Extract all media messages (images & videos) in starred list
  const mediaList = starredMessages.filter((m) => ['image', 'video'].includes(m.type) && !m.isDeleted);

  useEffect(() => {
    // Clear active space so socket events are managed correctly
    clearCurrentSpace();
    fetchStarredMessages();
  }, [clearCurrentSpace, fetchStarredMessages]);

  return (
    <div className="flex-grow p-6 md:p-10 overflow-y-auto max-w-5xl mx-auto w-full flex flex-col justify-start scroll-gpu">
      
      {/* Header welcome banner */}
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 bg-background-secondary border border-border-primary rounded-xl text-text-secondary hover:text-text-primary transition-all active:scale-95"
          title="Go Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text-primary flex items-center gap-2">
            <Star className="w-7 h-7 text-amber-500 fill-amber-500" /> Starred Messages
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            View all messages you've personally pinned or starred for quick access.
          </p>
        </div>
      </div>

      {/* Starred Messages List */}
      <div className="flex flex-col gap-4">
        {starredMessages.length === 0 ? (
          <div className="bg-background-secondary/50 border border-border-primary border-dashed p-12 rounded-2xl text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-background-secondary border border-border-primary flex items-center justify-center text-text-muted">
              <Star className="w-5 h-5" />
            </div>
            <p className="text-xs text-text-secondary">You haven't starred any messages yet.</p>
            <p className="text-[11px] text-text-muted max-w-xs">
              Hover over any chat message in a workspace and click the star icon to pin it here.
            </p>
          </div>
        ) : (
          starredMessages.map((msg) => {
            const senderName = msg.sender?.displayName || msg.sender?.username || 'AI Assistant';
            const spaceName = msg.space?.name || 'Workspace';
            const spaceId = msg.space?._id || msg.space;

            return (
              <div
                key={msg._id}
                className="bg-background-secondary border border-border-primary hover:border-border-primary/80 p-5 rounded-2xl shadow-sm transition-all flex flex-col gap-4 relative group"
              >
                {/* Top header row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-background-elevated border border-border-primary overflow-hidden flex items-center justify-center text-xs font-bold text-text-secondary flex-shrink-0">
                      {msg.sender?.avatar ? (
                        <img src={msg.sender.avatar} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        senderName.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-text-primary truncate">{senderName}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-secondary">
                        <span className="font-semibold text-accent-primary bg-accent-primary/10 px-1.5 py-0.5 rounded-md">
                          {spaceName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(msg.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions (Unstar / Jump) */}
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => togglePinMessage(msg._id)}
                      className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-xl transition-all"
                      title="Unstar Message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/space/${spaceId}`)}
                      className="px-3 py-1.5 bg-background-elevated hover:bg-background-elevated/80 text-text-primary border border-border-primary rounded-xl text-xs font-semibold transition-all"
                    >
                      Jump to Message
                    </button>
                  </div>
                </div>

                {/* Message Content */}
                <div className="pl-11 pr-2">
                  {msg.isDeleted ? (
                    <p className="text-xs italic text-text-muted">This message was deleted.</p>
                  ) : (
                    <>
                      {msg.type === 'text' && (
                        <p className="text-xs md:text-sm text-text-secondary leading-relaxed break-words whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      )}
                      
                      {msg.type === 'image' && msg.fileUrl && (
                        <div className="rounded-xl overflow-hidden border border-border-primary max-w-sm mt-1 cursor-zoom-in">
                          <img
                            src={msg.fileUrl}
                            alt={msg.fileName || 'starred content'}
                            onClick={(e) => {
                              e.stopPropagation();
                              const idx = mediaList.findIndex((m) => m._id.toString() === msg._id.toString());
                              setActiveMediaViewer({ initialIndex: idx >= 0 ? idx : 0 });
                            }}
                            className="max-h-40 w-full object-cover"
                          />
                        </div>
                      )}

                      {msg.type === 'video' && msg.fileUrl && (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            const idx = mediaList.findIndex((m) => m._id.toString() === msg._id.toString());
                            setActiveMediaViewer({ initialIndex: idx >= 0 ? idx : 0 });
                          }}
                          className="rounded-xl overflow-hidden border border-border-primary max-w-sm mt-1 bg-black relative cursor-pointer group/video"
                        >
                          <video src={msg.fileUrl} className="max-h-40 w-full object-contain pointer-events-none" />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover/video:bg-black/45 transition-colors">
                            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white scale-100 group-hover/video:scale-110 transition-transform shadow-lg">
                              <Play className="w-5 h-5 translate-x-0.5 fill-white text-white" />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MEDIA VIEWER MODAL */}
      <AnimatePresence>
        {activeMediaViewer && (
          <MediaViewer
            mediaList={mediaList}
            initialIndex={activeMediaViewer.initialIndex}
            onClose={() => setActiveMediaViewer(null)}
          />
        )}
      </AnimatePresence>

    </div>
  );
};

export default StarredMessages;
