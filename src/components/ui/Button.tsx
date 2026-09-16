import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...rest
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all active:scale-[0.98] select-none disabled:opacity-50 disabled:pointer-events-none focus:outline-none';

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'h-9 px-3.5 rounded-xl text-xs gap-1.5 min-h-[36px]',
    md: 'h-11 px-4 rounded-xl text-sm gap-2 min-h-[44px]',
    lg: 'h-13 px-5 rounded-2xl text-[15px] font-semibold gap-2 min-h-[50px]',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      'bg-[#315C36] text-white dark:bg-[#34C759] dark:text-[#000000] dark:font-bold hover:bg-[#284c2c] dark:hover:bg-[#30B753] active:bg-[#223f25] dark:active:bg-[#28A745] shadow-[0_2px_8px_rgba(49,92,54,0.2)] dark:shadow-[0_2px_14px_rgba(52,199,89,0.35)]',
    secondary:
      'bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] active:bg-[#D1D1D6] dark:active:bg-[#48484A]',
    ghost:
      'bg-transparent text-[#315C36] dark:text-[#34C759] hover:bg-[#E7F0E6]/50 dark:hover:bg-[#315C36]/20 active:bg-[#E7F0E6] dark:active:bg-[#315C36]/30',
    destructive:
      'bg-[#FF3B30]/10 dark:bg-[#FF453A]/20 text-[#FF3B30] dark:text-[#FF453A] hover:bg-[#FF3B30]/20 dark:hover:bg-[#FF453A]/30 active:bg-[#FF3B30]/30 font-semibold',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {icon && (
        <span className={`material-symbols-outlined shrink-0 ${size === 'sm' ? 'text-[16px]' : size === 'lg' ? 'text-[20px]' : 'text-[18px]'}`}>
          {icon}
        </span>
      )}
      <span>{children}</span>
      {iconRight && (
        <span className={`material-symbols-outlined shrink-0 ${size === 'sm' ? 'text-[16px]' : size === 'lg' ? 'text-[20px]' : 'text-[18px]'}`}>
          {iconRight}
        </span>
      )}
    </button>
  );
};
