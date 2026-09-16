import React from 'react';

interface StepIndicatorProps {
  currentStep: number; // 0-based
  totalSteps: number;
  title: string;
  subtitle?: string;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  totalSteps,
  title,
  subtitle,
}) => {
  const stepNumber = currentStep + 1;
  const progressPercent = Math.round((stepNumber / totalSteps) * 100);

  return (
    <div className="mb-4">
      {/* 진행 바 및 단계 번호 */}
      <div className="flex items-center justify-between text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93] mb-2">
        <span className="tabular-nums">
          <strong className="text-[#315C36] dark:text-[#34C759] font-bold text-sm">{stepNumber}</strong> / {totalSteps}
        </span>
        <span>{progressPercent}% 완료</span>
      </div>

      {/* 부드러운 프로그레스 트랙 */}
      <div className="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#315C36] dark:bg-[#34C759] rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 스텝 제목 & 서브타이틀 */}
      <div className="mt-3.5">
        <h2 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[#6E6E73] dark:text-[#8E8E93] mt-1 break-keep leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
