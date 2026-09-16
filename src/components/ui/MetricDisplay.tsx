import React from 'react';

interface MetricDisplayProps {
  label?: string;
  value: number | string;
  unit?: string;
  sub?: string;
  diff?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const MetricDisplay: React.FC<MetricDisplayProps> = ({
  label,
  value,
  unit,
  sub,
  diff,
  size = 'md',
  className = '',
}) => {
  const valueSizeClass =
    size === 'lg'
      ? 'text-[44px] sm:text-[52px]'
      : size === 'sm'
      ? 'text-[24px]'
      : 'text-[32px] sm:text-[36px]';

  const unitSizeClass =
    size === 'lg' ? 'text-[18px] ml-1' : size === 'sm' ? 'text-[12px] ml-0.5' : 'text-[14px] ml-1';

  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <span className="text-xs font-medium text-[#6E6E73] dark:text-[#8E8E93] mb-1">
          {label}
        </span>
      )}
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span
          className={`font-display-metric font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-none tabular-nums tracking-tight ${valueSizeClass}`}
        >
          {value}
        </span>
        {unit && (
          <span className={`font-display-metric text-[#6E6E73] dark:text-[#8E8E93] font-medium ${unitSizeClass}`}>
            {unit}
          </span>
        )}
        {diff !== undefined && (
          <span
            className={`font-label-numeric text-[13px] font-bold tabular-nums ml-1 ${
              diff < 0 ? 'text-[#315C36] dark:text-[#34C759]' : diff > 0 ? 'text-[#FF3B30] dark:text-[#FF453A]' : 'text-[#6E6E73] dark:text-[#8E8E93]'
            }`}
          >
            {diff > 0 ? `+${diff}` : diff}%p
          </span>
        )}
      </div>
      {sub && <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93] mt-1">{sub}</span>}
    </div>
  );
};
