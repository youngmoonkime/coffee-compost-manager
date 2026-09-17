import React from 'react';
import type { MoldStatus } from '../../../types';
import { MOLD_LABELS } from '../../../utils/fieldOps';

interface ConditionStepProps {
  moldStatus: MoldStatus | null;
  setMoldStatus: (v: MoldStatus) => void;
  odor: boolean | null;
  setOdor: (v: boolean) => void;
  ambientTempRaw: string;
  setAmbientTempRaw: (v: string) => void;
  ambientHumRaw: string;
  setAmbientHumRaw: (v: string) => void;
  onEnterNext: () => void;
}

const MOLD_OPTIONS: { value: MoldStatus; hint: string; tone: string }[] = [
  { value: 'none', hint: '보이지 않음', tone: 'bg-[#315C36] text-white' },
  { value: 'some', hint: '군데군데 보임', tone: 'bg-[#D97706] text-white' },
  { value: 'spreading', hint: '넓게 번짐', tone: 'bg-[#C5221F] text-white' },
];

/**
 * 더미 상태 점검.
 * 곰팡이는 깔개 사용을 미루는 가장 큰 이유라 반드시 고르게 한다 —
 * 비워 두면 "기록 없음"이 되어 판정이 보류된다.
 */
export const ConditionStep: React.FC<ConditionStepProps> = ({
  moldStatus,
  setMoldStatus,
  odor,
  setOdor,
  ambientTempRaw,
  setAmbientTempRaw,
  ambientHumRaw,
  setAmbientHumRaw,
  onEnterNext,
}) => (
  <div className="space-y-3">
    <div className="rounded-2xl bg-[#F2F2F7]/70 dark:bg-[#2C2C2E]/60 p-4 border border-black/5 dark:border-white/10">
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">곰팡이 상태</span>
        <span className="text-[10px] font-bold text-white bg-[#C5221F] px-1.5 py-0.5 rounded">필수</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="곰팡이 상태">
        {MOLD_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            aria-pressed={moldStatus === option.value}
            onClick={() => setMoldStatus(option.value)}
            className={`rounded-xl py-2.5 px-1 transition-all active:scale-95 border ${
              moldStatus === option.value
                ? `${option.tone} border-transparent`
                : 'bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#8E8E93] border-black/10 dark:border-white/10'
            }`}
          >
            <span className="block text-xs font-bold">{MOLD_LABELS[option.value]}</span>
            <span className="block text-[10px] opacity-80 mt-0.5">{option.hint}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-[#6E6E73] dark:text-[#8E8E93] mt-2.5 break-keep leading-relaxed">
        곰팡이가 보이면 깔개 사용 판단을 보류하고 혼합 안내를 띄웁니다.
      </p>
    </div>

    <div className="rounded-2xl bg-[#F2F2F7]/70 dark:bg-[#2C2C2E]/60 p-4 border border-black/5 dark:border-white/10 flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">이상 냄새</span>
      <div className="flex gap-1.5" role="group" aria-label="이상 냄새">
        {[
          { on: false, text: '없음' },
          { on: true, text: '있음' },
        ].map(option => (
          <button
            key={option.text}
            type="button"
            aria-pressed={odor === option.on}
            onClick={() => setOdor(option.on)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
              odor === option.on
                ? 'bg-[#315C36] text-white'
                : 'bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#8E8E93] border border-black/10 dark:border-white/10'
            }`}
          >
            {option.text}
          </button>
        ))}
      </div>
    </div>

    <div className="rounded-2xl bg-[#F2F2F7]/70 dark:bg-[#2C2C2E]/60 p-4 border border-black/5 dark:border-white/10">
      <span className="block text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-0.5">
        외기 온도 · 습도
      </span>
      <span className="block text-xs text-[#6E6E73] dark:text-[#8E8E93] mb-3">
        선택 항목입니다. 비워 두어도 점검을 저장할 수 있습니다.
      </span>

      <div className="grid grid-cols-2 gap-3">
        <label className="rounded-xl bg-white dark:bg-[#1C1C1E] py-3 px-2 text-center border border-black/5 dark:border-white/10 block">
          <span className="block text-[11px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] mb-1">온도</span>
          <div className="flex items-baseline justify-center gap-1">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={ambientTempRaw}
              placeholder="--"
              aria-label="외기 온도 (℃)"
              onChange={e => setAmbientTempRaw(e.target.value)}
              className="w-[4ch] bg-transparent text-center font-display-metric text-[28px] leading-none font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums focus:outline-none caret-[#315C36] dark:caret-[#34C759] placeholder:text-black/20 dark:placeholder:text-white/20"
            />
            <span className="font-display-metric text-sm text-[#6E6E73] dark:text-[#8E8E93] font-semibold">℃</span>
          </div>
        </label>

        <label className="rounded-xl bg-white dark:bg-[#1C1C1E] py-3 px-2 text-center border border-black/5 dark:border-white/10 block">
          <span className="block text-[11px] font-semibold text-[#6E6E73] dark:text-[#8E8E93] mb-1">습도</span>
          <div className="flex items-baseline justify-center gap-1">
            <input
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
              className="w-[4ch] bg-transparent text-center font-display-metric text-[28px] leading-none font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums focus:outline-none caret-[#315C36] dark:caret-[#34C759] placeholder:text-black/20 dark:placeholder:text-white/20"
            />
            <span className="font-display-metric text-sm text-[#6E6E73] dark:text-[#8E8E93] font-semibold">%</span>
          </div>
        </label>
      </div>
    </div>
  </div>
);
