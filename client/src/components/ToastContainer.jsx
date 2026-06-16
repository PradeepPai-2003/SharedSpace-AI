import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUiStore } from '../stores/uiStore';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const ToastContainer = () => {
  const { notifications, removeNotification } = useUiStore(
    useShallow((state) => ({
      notifications: state.notifications,
      removeNotification: state.removeNotification,
    }))
  );

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-accent-ai" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-danger" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default:
        return <Info className="w-5 h-5 text-accent-primary" />;
    }
  };

  const getBorderColor = (type) => {
    switch (type) {
      case 'success':
        return 'border-accent-ai/30';
      case 'error':
        return 'border-danger/30';
      case 'warning':
        return 'border-amber-500/30';
      default:
        return 'border-accent-primary/30';
    }
  };

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full">
      {notifications.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-4 bg-background-elevated border ${getBorderColor(toast.type)} rounded-xl shadow-2xl transition-all duration-300 transform translate-x-0 slide-in-toast`}
          style={{
            animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          <div className="flex-shrink-0 mt-0.5">{getIcon(toast.type)}</div>
          
          <div className="flex-grow">
            <h4 className="text-sm font-semibold text-text-primary">{toast.title}</h4>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">{toast.content}</p>
          </div>

          <button
            onClick={() => removeNotification(toast.id)}
            className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default ToastContainer;
