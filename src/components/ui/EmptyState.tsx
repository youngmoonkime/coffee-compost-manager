import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox',
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`apple-card p-8 sm:p-12 text-center flex flex-col items-center justify-center ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#F2F2F7] dark:bg-[#2C2C2E] flex items-center justify-center text-[#6E6E73] dark:text-[#8E8E93] mb-3">
        <span className="material-symbols-outlined text-[28px]">{icon}</span>
      </div>
      <h3 className="text-base font-bold text-[#1D1D1F] dark:text-[#F5F5F7] break-keep">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-[#6E6E73] dark:text-[#8E8E93] mt-1.5 max-w-sm break-keep leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
