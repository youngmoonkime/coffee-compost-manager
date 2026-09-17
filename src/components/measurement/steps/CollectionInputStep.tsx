import React from 'react';

interface CollectionInputStepProps {
  addedRaw: string;
  setAddedRaw: (v: string) => void;
  currentPileKg: number;
  onEnterNext: () => void;
}

const COMMON_AMOUNTS = [300, 500, 1000, 1500, 2000] as const;

/**
 * 커피박 수거 및 파봉 작업 - 신규 수거/투입량(kg) 입력 스텝
 */
export const CollectionInputStep: React.FC<CollectionInputStepProps> = ({
  addedRaw,
  setAddedRaw,
  currentPileKg,
  onEnterNext,
}) => (
  <div className="space-y-4">
    <div className="rounded-2xl bg-[#F2F2F7]/70 dark:bg-[#2C2C2E]/60 p-5 border border-black/5 dark:border-white/10 text-center">
      <span className="block text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93] mb-2">
        오늘 새로 수거하여 하역한 커피박량
      </span>

      <div className="flex items-baseline justify-center gap-1.5 my-3">
        <input
          type="number"
          inputMode="numeric"
          step="1"
          value={addedRaw}
          placeholder="0"
          autoFocus
          aria-label="신규 수거/투입량 (kg)"
          onChange={e => setAddedRaw(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEnterNext();
            }
          }}
          className="w-[6ch] bg-transparent text-center font-display-metric text-[40px] leading-none font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums focus:outline-none caret-[#315C36] dark:caret-[#34C759] placeholder:text-black/20 dark:placeholder:text-white/20"
        />
        <span className="font-display-metric text-lg text-[#6E6E73] dark:text-[#8E8E93] font-semibold">kg</span>
      </div>

      {/* 빠른 선택 칩 */}
      <div className="flex flex-wrap justify-center gap-1.5 mt-3">
        {COMMON_AMOUNTS.map(amount => (
          <button
            key={amount}
            type="button"
            onClick={() => setAddedRaw(String(amount))}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
              addedRaw === String(amount)
                ? 'bg-[#315C36] text-white font-bold'
                : 'bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#8E8E93] border border-black/10 dark:border-white/10'
            }`}
          >
            {amount.toLocaleString('ko-KR')}kg
          </button>
        ))}
      </div>
    </div>

    {/* 기존 더미량과 합산 예상 안내 */}
    <div className="apple-card p-3.5 flex items-center justify-between text-xs">
      <span className="text-[#6E6E73] dark:text-[#8E8E93]">기존 더미량</span>
      <span className="font-display-metric text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
        {currentPileKg.toLocaleString('ko-KR')} kg
      </span>
    </div>
  </div>
);
