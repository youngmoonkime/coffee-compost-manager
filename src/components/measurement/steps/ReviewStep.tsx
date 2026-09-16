import React from 'react';

interface ReviewStepProps {
  ranchName: string;
  location: string;
  date: string;
  time: string;
  collectedKg: number | null;
  coreTemp: number | null;
  moisture: number | null;
  ambientTemp: number | null;
  ambientHum: number | null;
  photoCount: number;
  notes: string;
  setNotes: (v: string) => void;
}

const QUICK_NOTES = ['교반 실시', '침출수 발생', '악취 심함', '강우', '차수막 덮음', '깔개로 사용'] as const;
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
  ranchName,
  location,
  date,
  time,
  collectedKg,
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
          <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">커피박 수거량</span>
          <span className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7] font-display-metric tabular-nums">
            {collectedKg !== null ? `${collectedKg.toLocaleString('ko-KR')} kg` : '--'}
          </span>
        </div>

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
          특이사항 및 메모 (선택)
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="교반 실시, 침출수 등 현장 특이사항을 적어주세요"
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
