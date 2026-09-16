import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  interactive = false,
  className = '',
  children,
  ...rest
}) => {
  return (
    <div
      className={`${interactive ? 'apple-card-interactive cursor-pointer' : 'apple-card'} p-4 sm:p-5 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};
