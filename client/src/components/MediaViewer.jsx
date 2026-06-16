import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, Download, RotateCw, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

const MediaViewer = ({ mediaList, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const currentMedia = mediaList[currentIndex];

  useEffect(() => {
    // Reset zoom and rotation when switching media
    setScale(1);
    setRotation(0);
  }, [currentIndex]);

  const handlePrev = (e) => {
    if (e) e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = (e) => {
    if (e) e.stopPropagation();
    if (currentIndex < mediaList.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Keyboard navigation and closing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, mediaList]);

  // Prevent background scrolling while viewer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.5, 1));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const src = currentMedia.fileUrl;
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = currentMedia.fileName || 'shared-media';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      window.open(currentMedia.fileUrl, '_blank');
    }
  };

  const handleDoubleTap = (e) => {
    e.stopPropagation();
    if (currentMedia.type === 'video') return;
    if (scale > 1) {
      handleReset();
    } else {
      setScale(2.5);
    }
  };

  if (!currentMedia) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md select-none touch-none"
    >
      {/* Top Controls Toolbar */}
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between px-6 z-[1010]"
      >
        <div className="flex flex-col min-w-0 max-w-[40%]">
          <span className="text-xs md:text-sm font-semibold text-white/95 truncate">
            {currentMedia.fileName || 'Shared Media'}
          </span>
          <span className="text-[10px] text-white/50 mt-0.5">
            {currentIndex + 1} / {mediaList.length}
          </span>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          {currentMedia.type === 'image' && (
            <>
              <button
                onClick={handleZoomIn}
                disabled={scale >= 4}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-all"
                title="Zoom In"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              
              <button
                onClick={handleZoomOut}
                disabled={scale <= 1}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-all"
                title="Zoom Out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>

              <button
                onClick={handleRotate}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                title="Rotate"
              >
                <RotateCw className="w-5 h-5" />
              </button>

              {(scale > 1 || rotation !== 0) && (
                <button
                  onClick={handleReset}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                  title="Reset"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              )}
            </>
          )}

          <button
            onClick={handleDownload}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            title="Download Media"
          >
            <Download className="w-5 h-5" />
          </button>

          <div className="w-[1px] h-6 bg-white/20 my-auto mx-1" />

          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all bg-white/5"
            title="Close Viewer (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation Arrows */}
      {mediaList.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-[1010] p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 text-white disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:border-white/10 transition-all active:scale-95"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <button
            onClick={handleNext}
            disabled={currentIndex === mediaList.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-[1010] p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 text-white disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:border-white/10 transition-all active:scale-95"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Content Rendering Body */}
      <div className="w-full h-full flex items-center justify-center p-4">
        {currentMedia.type === 'image' ? (
          <motion.div
            key={currentMedia._id}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ 
              scale: scale, 
              rotate: rotation,
              opacity: 1 
            }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ 
              type: 'spring', 
              damping: 25, 
              stiffness: 300 
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={handleDoubleTap}
            drag={scale > 1}
            dragConstraints={{ left: -300 * scale, right: 300 * scale, top: -200 * scale, bottom: 200 * scale }}
            dragElastic={0.15}
            className="cursor-grab active:cursor-grabbing max-w-full max-h-[85vh] flex items-center justify-center"
            style={{
              touchAction: scale > 1 ? 'none' : 'auto'
            }}
          >
            <img
              src={currentMedia.fileUrl}
              alt={currentMedia.fileName || 'Fullscreen Image'}
              className="max-w-full max-h-[80vh] md:max-h-[85vh] rounded shadow-2xl object-contain pointer-events-none select-none"
            />
          </motion.div>
        ) : (
          <motion.div
            key={currentMedia._id}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[80vh] md:max-h-[85vh] rounded-lg overflow-hidden bg-black shadow-2xl border border-white/10"
          >
            <video
              src={currentMedia.fileUrl}
              controls
              autoPlay
              className="w-full h-full max-h-[80vh] md:max-h-[85vh] object-contain"
            />
          </motion.div>
        )}
      </div>

      {/* Touch Info overlay */}
      {currentMedia.type === 'image' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-[10px] md:text-xs text-center pointer-events-none select-none z-10 px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-sm">
          {scale > 1 ? 'Drag to pan around' : 'Double tap to zoom'}
        </div>
      )}
    </motion.div>
  );
};

export default MediaViewer;
