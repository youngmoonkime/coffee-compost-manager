import React from 'react';
import { useToast } from '../../contexts/ToastContext';

export const Toast: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[90%] max-w-sm pointer-events-none">
      {toasts.map(toast => {
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 transition-all transform animate-in fade-in slide-in-from-top-2 duration-200 ${
              isError
                ? 'bg-error text-on-error'
                : isWarning
                ? 'bg-tertiary-container text-on-tertiary'
                : 'bg-inverse-surface text-inverse-on-surface'
            }`}
            onClick={() => removeToast(toast.id)}
          >
            <span className={`material-symbols-outlined text-[22px] shrink-0 ${
              isError ? 'text-white' : 'text-primary-fixed-dim'
            }`}>
              {isError ? 'error' : isWarning ? 'warning' : 'check_circle'}
            </span>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-label-md text-label-md leading-tight truncate">
                {toast.title}
              </span>
              {toast.sub && (
                <span className="font-caption text-caption opacity-85 mt-0.5 truncate">
                  {toast.sub}
                </span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="text-current opacity-60 hover:opacity-100 p-0.5"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};
