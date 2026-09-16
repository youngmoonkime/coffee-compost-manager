import React from 'react';

interface CollectionAmountStepProps {
  collectedRaw: string;
  setCollectedRaw: (v: string) => void;
  weekly: { start: string; end: string; count: number; totalKg: number };
  onEnterNext: () => void;
}

const COMMON_AMOUNTS = [0, 500, 1000, 1500, 2000, 3000] as const;

export const CollectionAmountStep: React.FC<CollectionAmountStepProps> = ({
  collectedRaw,
  setCollectedRaw,
  weekly,
  onEnterNext,
}) => {
  return (
    <div className="space-y-4">
      {/* 큼직한 계측기 스타일 수거량 입력 UI */}
      <div className="rounded-2xl bg-[#F2F2F7]/70 dark:bg-[#2C2C2E]/60 py-6 px-4 text-center border border-black/5 dark:border-white/10">
        <span className="block text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93] mb-2">
          이번에 하역한 커피박 무게
        </span>

        <div className="flex items-baseline justify-center gap-1.5">
          <input
            type="number"
            inputMode="numeric"
            step="1"
            value={collectedRaw}
            placeholder="0"
            autoFocus
            aria-label="커피박 수거량 (kg)"
            onChange={e => setCollectedRaw(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onEnterNext();
              }
            }}
            className="w-[5ch] bg-transparent text-center font-display-metric text-[44px] sm:text-[52px] leading-none font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums focus:outline-none caret-[#315C36] dark:caret-[#34C759] placeholder:text-black/20 dark:placeholder:text-white/20"
          />
          <span className="font-display-metric text-lg sm:text-xl text-[#6E6E73] dark:text-[#8E8E93] font-semibold">
            kg
          </span>
        </div>

        <p className="text-xs text-[#6E6E73] dark:text-[#8E8E93] mt-2">
          새로 들여온 커피박이 없다면 <strong>0</strong>으로 두시면 됩니다.
        </p>

        {/* 빠른 입력 칩 */}
        <div className="flex flex-wrap justify-center gap-1.5 mt-3.5">
          {COMMON_AMOUNTS.map(amt => (
            <button
              key={amt}
              type="button"
              onClick={() => setCollectedRaw(String(amt))}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                collectedRaw === String(amt)
                  ? 'bg-[#315C36] text-white'
                  : 'bg-white dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#8E8E93] border border-black/5 dark:border-white/10 hover:text-[#1D1D1F] dark:hover:text-[#FFFFFF]'
              }`}
            >
              {amt === 0 ? '0 (없음)' : `${amt.toLocaleString('ko-KR')}kg`}
            </button>
          ))}
        </div>
      </div>

      {/* 이번 주 누적 현황 요약 */}
      <div className="apple-card p-4 flex items-center justify-between text-xs">
        <div>
          <span className="text-[#6E6E73] dark:text-[#8E8E93] block">
            이번 주 누적 하역량 ({weekly.start} ~ {weekly.end})
          </span>
          <span className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5 block">
            총 {weekly.count}회 하역
          </span>
        </div>
        <div className="text-right">
          <span className="font-display-metric text-base font-bold text-[#315C36] dark:text-[#34C759] tabular-nums">
            {weekly.totalKg.toLocaleString('ko-KR')} kg
          </span>
        </div>
      </div>
    </div>
  );
};
