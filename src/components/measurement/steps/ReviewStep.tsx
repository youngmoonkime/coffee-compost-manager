import React from 'react';
import type { MoldStatus } from '../../../types';
import { MOLD_LABELS } from '../../../utils/fieldOps';

interface ReviewStepProps {
  /** 'inspection' = 현장 점검, 'measurement' = 새 커피박 투입 */
  mode: 'inspection' | 'measurement';
  ranchName: string;
  location: string;
  date: string;
  time: string;
  /** 이번 방문에 새로 부은 커피박(kg) */
  collectedKg: number | null;
  beddingUsedKg: number | null;
  mixed: boolean | null;
  moldStatus: MoldStatus | null;
  odor: boolean | null;
  coreTemp: number | null;
  moisture: number | null;
  ambientTemp: number | null;
  ambientHum: number | null;
  photoCount: number;
  notes: string;
  setNotes: (v: string) => void;
}

// 혼합·깔개 사용·냄새는 따로 고르는 항목이 되었으므로 여기서는 빼고, 그 밖의 현장 상황만 남긴다
const QUICK_NOTES = ['파봉 작업', '침출수 발생', '강우', '차수막 덮음', '바닥 정리', '장비 사용'] as const;
const NOTE_SEPARATOR = ', ';

function splitNotes(text: string): string[] {
  return text.split(NOTE_SEPARATOR).map(t => t.trim()).filter(Boolean);
}

function toggleNote(text: string, preset: string): string {
  const parts = splitNotes(text);
  const idx = parts.indexOf(preset);
  if (idx >= 0) parts.splice(idx, 1);
  else parts.push(preset);
  return parts.join(NOTE_SEPARATOR);
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  mode,
  ranchName,
  location,
  date,
  time,
  collectedKg,
  beddingUsedKg,
  mixed,
  moldStatus,
  odor,
  coreTemp,
  moisture,
  ambientTemp,
  ambientHum,
  photoCount,
  notes,
  setNotes,
}) => {
  const activePresets = splitNotes(notes);

  return (
    <div className="space-y-4">
      {/* 1. 입력 요약 리스트 */}
      <div className="apple-card overflow-hidden divide-y divide-black/5 dark:divide-white/10">
        <div className="flex items-center justify-between p-3.5">
          <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">장소 / 일시</span>
          <div className="text-right">
            <span className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7] block">{ranchName} · {location}</span>
            <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93] tabular-nums">{date} {time}</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-3.5">
          <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">오늘 한 작업</span>
          <span className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {(mode === 'measurement'
              ? ['투입']
              : ['점검', mixed ? '혼합' : null, beddingUsedKg ? '깔개 사용' : null]
            )
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>

        {mode === 'measurement' ? (
          <div className="flex items-center justify-between p-3.5">
            <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">신규 투입량</span>
            <span className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7] font-display-metric tabular-nums">
              {(collectedKg ?? 0).toLocaleString('ko-KR')} kg
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-3.5">
              <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">깔개 사용</span>
              <span className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7] font-display-metric tabular-nums">
                {(beddingUsedKg ?? 0).toLocaleString('ko-KR')} kg
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5">
              <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">곰팡이 / 이상 냄새</span>
              <span
                className={`text-sm font-bold ${
                  moldStatus && moldStatus !== 'none'
                    ? 'text-[#C5221F] dark:text-[#FF453A]'
                    : 'text-[#1D1D1F] dark:text-[#F5F5F7]'
                }`}
              >
                {moldStatus ? MOLD_LABELS[moldStatus] : '--'} / {odor === null ? '--' : odor ? '있음' : '없음'}
              </span>
            </div>
          </>
        )}

        {mode === 'measurement' && (
          <>
            <div className="flex items-center justify-between p-3.5">
              <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">심부 측정 평균 (3지점)</span>
              <div className="text-right">
                <span className="text-sm font-bold text-[#315C36] dark:text-[#34C759] font-display-metric tabular-nums block">
                  함수율 {moisture !== null ? `${moisture.toFixed(1)}%` : '--'}
                </span>
                <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93] font-display-metric tabular-nums">
                  온도 {coreTemp !== null ? `${coreTemp.toFixed(1)}℃` : '--'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5">
              <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">외기 환경</span>
              <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] font-display-metric tabular-nums">
                {ambientTemp !== null ? `${ambientTemp}℃` : '--'} / {ambientHum !== null ? `${ambientHum}%` : '--'}
              </span>
            </div>
          </>
        )}

        {photoCount > 0 && (
          <div className="flex items-center justify-between p-3.5">
            <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">첨부 사진</span>
            <span className="text-xs font-semibold text-[#315C36] dark:text-[#34C759]">
              {photoCount}장
            </span>
          </div>
        )}
      </div>

      {/* 2. 현장 특이사항 입력 */}
      <div>
        <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5">
          특이사항 (선택 · 시트 비고 칸에 기록됩니다)
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="침출수, 강우 등 오늘 현장에서 본 것을 적어주세요"
          className="w-full bg-white dark:bg-[#2C2C2E] rounded-xl p-3 text-sm text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/10 dark:border-white/10 focus:outline-none focus:border-[#315C36] dark:focus:border-[#34C759] resize-none"
        />

        {/* 빠른 특이사항 칩 */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {QUICK_NOTES.map(preset => {
            const isSelected = activePresets.includes(preset);
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setNotes(toggleNote(notes, preset))}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-[#315C36] text-white'
                    : 'bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#FFFFFF]'
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
