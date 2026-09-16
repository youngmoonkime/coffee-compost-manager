import React, { useRef } from 'react';

interface EnvironmentStepProps {
  ambientTempRaw: string;
  setAmbientTempRaw: (v: string) => void;
  ambientHumRaw: string;
  setAmbientHumRaw: (v: string) => void;
  onEnterNext: () => void;
}

export const EnvironmentStep: React.FC<EnvironmentStepProps> = ({
  ambientTempRaw,
  setAmbientTempRaw,
  ambientHumRaw,
  setAmbientHumRaw,
  onEnterNext,
}) => {
  const humInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* 외기 온도 */}
        <label className="rounded-2xl bg-[#F2F2F7]/70 dark:bg-[#2C2C2E]/60 py-5 px-3 text-center border border-black/5 dark:border-white/10 block">
          <span className="block text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93] mb-2">
            외기 온도
          </span>
          <div className="flex items-baseline justify-center gap-1">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={ambientTempRaw}
              placeholder="--"
              autoFocus
              aria-label="외기 온도 (℃)"
              onChange={e => setAmbientTempRaw(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  humInputRef.current?.focus();
                }
              }}
              className="w-[4ch] bg-transparent text-center font-display-metric text-[36px] sm:text-[42px] leading-none font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums focus:outline-none caret-[#315C36] dark:caret-[#34C759] placeholder:text-black/20 dark:placeholder:text-white/20"
            />
            <span className="font-display-metric text-base text-[#6E6E73] dark:text-[#8E8E93] font-semibold">
              ℃
            </span>
          </div>
        </label>

        {/* 외기 습도 */}
        <label className="rounded-2xl bg-[#F2F2F7]/70 dark:bg-[#2C2C2E]/60 py-5 px-3 text-center border border-black/5 dark:border-white/10 block">
          <span className="block text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93] mb-2">
            외기 습도
          </span>
          <div className="flex items-baseline justify-center gap-1">
            <input
              ref={humInputRef}
              type="number"
              inputMode="decimal"
              step="0.1"
              value={ambientHumRaw}
              placeholder="--"
              aria-label="외기 습도 (%)"
              onChange={e => setAmbientHumRaw(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onEnterNext();
                }
              }}
              className="w-[4ch] bg-transparent text-center font-display-metric text-[36px] sm:text-[42px] leading-none font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums focus:outline-none caret-[#315C36] dark:caret-[#34C759] placeholder:text-black/20 dark:placeholder:text-white/20"
            />
            <span className="font-display-metric text-base text-[#6E6E73] dark:text-[#8E8E93] font-semibold">
              %
            </span>
          </div>
        </label>
      </div>

      <p className="text-xs text-[#6E6E73] dark:text-[#8E8E93] text-center leading-relaxed">
        현장 기상 조건(외기 온도와 습도)은 더미의 수분 증발과 미생물 활성도 해석의 기준이 됩니다.
      </p>
    </div>
  );
};
