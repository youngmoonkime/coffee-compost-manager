import React from 'react';
import { CORE_POINT_COUNT, CORE_POINT_SPACING_CM } from '../../../utils/calculations';
import type { CorePoint } from '../../../types';

export type PointState = 'done' | 'active' | 'empty';

interface CoreMeasurementStepProps {
  corePointsRaw: { temp: string; moisture: string }[];
  setPointValue: (index: number, key: 'temp' | 'moisture', value: string) => void;
  pointStates: PointState[];
  filledCount: number;
  average: CorePoint | null;
  pointInputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onEnterNext: () => void;
}

/**
 * 같은 높이에서 30cm 간격으로 재는 3지점 안내 그림.
 * 값을 넣은 지점은 채워지고(point-pop), 지금 잴 지점은 링이 퍼진다(point-pulse).
 */
export const CorePointDiagram: React.FC<{ states: PointState[] }> = ({ states }) => {
  const doneCount = states.filter(s => s === 'done').length;
  return (
    <svg
      viewBox="0 0 300 96"
      className="w-full h-[96px]"
      role="img"
      aria-label={`같은 높이 ${CORE_POINT_SPACING_CM}cm 간격 3지점 측정. ${doneCount}지점 입력됨.`}
    >
      {/* 더미 단면 */}
      <path
        d="M8 86 C 62 36, 112 22, 150 22 C 188 22, 238 36, 292 86 Z"
        fill="#315C36"
        fillOpacity="0.12"
      />
      <path
        d="M8 86 C 62 36, 112 22, 150 22 C 188 22, 238 36, 292 86"
        fill="none"
        stroke="#315C36"
        strokeOpacity="0.35"
        strokeWidth="2"
      />

      {/* 같은 높이(횡구간) 기준선 */}
      <line
        x1="52"
        y1="60"
        x2="248"
        y2="60"
        stroke="#315C36"
        strokeOpacity="0.3"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />

      {/* 지점 간격 */}
      {[105, 195].map(x => (
        <text
          key={x}
          x={x}
          y={52}
          textAnchor="middle"
          fontSize="10"
          fontWeight="700"
          fill="#7a573b"
        >
          {CORE_POINT_SPACING_CM}cm
        </text>
      ))}

      {states.map((state, i) => {
        const cx = 60 + i * 90;
        return (
          <g key={`${i}-${state}`}>
            {state === 'active' && (
              <circle
                cx={cx}
                cy={60}
                r={11}
                fill="#315C36"
                fillOpacity="0.4"
                className="point-pulse"
              />
            )}
            <circle
              cx={cx}
              cy={60}
              r={11}
              fill={state === 'done' ? '#315C36' : '#ffffff'}
              fillOpacity={state === 'done' ? 1 : 0.85}
              stroke="#315C36"
              strokeWidth={2}
              strokeDasharray={state === 'empty' ? '3 3' : undefined}
              className={state === 'done' ? 'point-pop' : ''}
            />
            <text
              x={cx}
              y={64}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill={state === 'done' ? '#ffffff' : '#315C36'}
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export const CoreMeasurementStep: React.FC<CoreMeasurementStepProps> = ({
  corePointsRaw,
  setPointValue,
  pointStates,
  filledCount,
  average,
  pointInputRefs,
  onEnterNext,
}) => {
  return (
    <div className="space-y-4">
      {/* 1. 심부 3지점 단면 다이어그램 */}
      <div className="rounded-2xl bg-[#F2F2F7]/70 dark:bg-[#2C2C2E]/60 p-3 text-center border border-black/5 dark:border-white/10">
        <CorePointDiagram states={pointStates} />
        <div className="mt-1 text-xs text-[#6E6E73] dark:text-[#8E8E93] flex items-center justify-center gap-2">
          <span>더미 동일 높이에서 <strong>30cm 간격</strong>으로 3곳을 측정합니다.</span>
          <span className="font-semibold text-[#315C36] dark:text-[#34C759]">({filledCount} / {CORE_POINT_COUNT} 완료)</span>
        </div>
      </div>

      {/* 2. 지점별 입력 행 */}
      <div className="space-y-2.5">
        {corePointsRaw.map((point, i) => {
          const isDone = pointStates[i] === 'done';
          const isActive = pointStates[i] === 'active';

          return (
            <div
              key={i}
              className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${
                isActive
                  ? 'bg-white dark:bg-[#1C1C1E] border-[#315C36] dark:border-[#34C759] ring-2 ring-[#315C36]/10 dark:ring-[#34C759]/20 shadow-xs'
                  : isDone
                  ? 'bg-white dark:bg-[#1C1C1E] border-black/5 dark:border-white/10'
                  : 'bg-[#F9F9FB] dark:bg-[#2C2C2E]/50 border-black/5 dark:border-white/10 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold flex items-center gap-1.5 text-[#1D1D1F] dark:text-[#F5F5F7]">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      isDone
                        ? 'bg-[#315C36] text-white'
                        : isActive
                        ? 'bg-[#E7F0E6] dark:bg-[#315C36]/30 text-[#315C36] dark:text-[#34C759]'
                        : 'bg-[#E5E5EA] dark:bg-[#3A3A3C] text-[#6E6E73] dark:text-[#8E8E93]'
                    }`}
                  >
                    {i + 1}
                  </span>
                  {i + 1}번째 지점
                </span>
                {isDone && (
                  <span className="text-[11px] font-semibold text-[#315C36] dark:text-[#34C759] flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[14px]">check</span> 입력됨
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* 온도 */}
                <label className="block bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-xl py-2 px-3">
                  <span className="block text-[11px] text-[#6E6E73] dark:text-[#8E8E93] mb-0.5">심부 온도</span>
                  <div className="flex items-baseline gap-1">
                    <input
                      ref={el => {
                        pointInputRefs.current[i * 2] = el;
                      }}
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={point.temp}
                      placeholder="--"
                      autoFocus={i === 0}
                      aria-label={`${i + 1}번째 지점 심부 온도(℃)`}
                      onChange={e => setPointValue(i, 'temp', e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          // 다음 칸(함수율)으로 포커스
                          pointInputRefs.current[i * 2 + 1]?.focus();
                        }
                      }}
                      className="w-full bg-transparent text-lg font-bold font-display-metric text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums focus:outline-none placeholder:text-black/20 dark:placeholder:text-white/20"
                    />
                    <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93] font-semibold">℃</span>
                  </div>
                </label>

                {/* 함수율 */}
                <label className="block bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-xl py-2 px-3">
                  <span className="block text-[11px] text-[#6E6E73] dark:text-[#8E8E93] mb-0.5">함수율</span>
                  <div className="flex items-baseline gap-1">
                    <input
                      ref={el => {
                        pointInputRefs.current[i * 2 + 1] = el;
                      }}
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={point.moisture}
                      placeholder="--"
                      aria-label={`${i + 1}번째 지점 함수율(%)`}
                      onChange={e => setPointValue(i, 'moisture', e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (i < CORE_POINT_COUNT - 1) {
                            pointInputRefs.current[(i + 1) * 2]?.focus();
                          } else {
                            onEnterNext();
                          }
                        }
                      }}
                      className="w-full bg-transparent text-lg font-bold font-display-metric text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums focus:outline-none placeholder:text-black/20 dark:placeholder:text-white/20"
                    />
                    <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93] font-semibold">%</span>
                  </div>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. 실시간 3지점 평균 요약 배너 */}
      {average && (
        <div className="apple-card p-3.5 sm:p-4 bg-[#E7F0E6]/50 dark:bg-[#315C36]/20 border-[#315C36]/20 dark:border-[#315C36]/40 flex items-center justify-between transition-all">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#315C36] dark:text-[#34C759] block">
                {filledCount === CORE_POINT_COUNT ? '3지점 평균 대푯값' : '현재까지 입력 평균'}
              </span>
              {filledCount === CORE_POINT_COUNT && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#34C759]/20 text-[#285A2E] dark:text-[#34C759]">
                  완료
                </span>
              )}
            </div>
            <span className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93]">이 평균값이 대장에 기록됩니다</span>
          </div>

          <div className="flex items-baseline gap-3.5 text-right">
            <div>
              <span className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93] block">평균 온도</span>
              <span className="font-display-metric text-lg font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums tracking-tight">
                {average.coreTemp.toFixed(1)}℃
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93] block">평균 함수율</span>
              <span className="font-display-metric text-lg font-bold text-[#315C36] dark:text-[#34C759] tabular-nums tracking-tight">
                {average.moisture.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
