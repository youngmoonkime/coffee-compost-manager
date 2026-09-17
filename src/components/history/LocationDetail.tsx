import React from 'react';
import type { PileSummary } from '../../utils/calculations';
import { formatShortDate } from '../../utils/calculations';
import { useCompost } from '../../contexts/CompostContext';
import { useAccess } from '../../contexts/AccessContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { MetricDisplay } from '../ui/MetricDisplay';
import { MoistureChart } from '../common/MoistureChart';
import { PileRecordList } from './PileRecordList';

interface LocationDetailProps {
  summary: PileSummary;
  onBack?: () => void;
}

export const LocationDetail: React.FC<LocationDetailProps> = ({ summary, onBack }) => {
  const { setMeasurePile, setActiveTab } = useCompost();
  const { isManager } = useAccess();
  const { pile, latest, verdict, records, allRecords, measured, lastVisitDate, totalCollectedKg } = summary;
  const previous = records[records.length - 2];
  const diffMoisture = previous ? Number((latest.moisture - previous.moisture).toFixed(1)) : undefined;

  const handleStartMeasurement = () => {
    setMeasurePile(pile);
    setActiveTab('monitoring');
  };

  return (
    <div className="flex flex-col w-full space-y-4 pb-8">
      {/* 모바일 뒤로가기 버튼 */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="self-start flex items-center gap-1 text-xs font-semibold text-[#315C36] dark:text-[#34C759] py-1 active:opacity-70"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          장소 목록으로
        </button>
      )}

      {/* 1. 장소 및 상태 요약 카드 */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93] block">{pile.ranchName}</span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5 tracking-tight">
              {pile.location}
            </h2>
          </div>
          <StatusBadge type={verdict.type} size="md" />
        </div>

        {/* 함수율 & 심부 온도 메트릭 */}
        <div className="flex items-baseline justify-between mt-4">
          {measured ? (
            <MetricDisplay
              label="현재 함수율"
              value={latest.moisture}
              unit="%"
              diff={diffMoisture}
              size="lg"
            />
          ) : (
            <div>
              <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93] block mb-1">현재 함수율</span>
              <span className="text-sm font-semibold text-[#6E6E73] dark:text-[#8E8E93]">아직 측정 없음</span>
            </div>
          )}
          <div className="text-right">
            <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93] block mb-1">심부 온도</span>
            <span className="font-display-metric text-2xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
              {measured ? `${latest.coreTemp}℃` : '—'}
            </span>
          </div>
        </div>

        {/* 권장 행동 안내 */}
        <div className="mt-4 p-3 rounded-xl bg-[#F2F2F7] dark:bg-[#2C2C2E] flex items-start gap-2.5">
          <span className="material-symbols-outlined text-[20px] text-[#315C36] dark:text-[#34C759] shrink-0 mt-0.5">
            assignment
          </span>
          <div className="min-w-0">
            <span className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {verdict.title}: 권장 행동
            </span>
            <p className="text-xs text-[#6E6E73] dark:text-[#8E8E93] mt-0.5 break-keep leading-relaxed">
              {verdict.action}
            </p>
            {verdict.timing && (
              <span className="inline-block mt-1 text-[11px] font-semibold text-[#315C36] dark:text-[#34C759]">
                📅 {verdict.timing}
              </span>
            )}
          </div>
        </div>

        {/* 통계 요약 3열 */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3.5 border-t border-black/5 dark:border-white/10 text-center">
          <div>
            <span className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93] block">최근 기록</span>
            <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5 block">
              {formatShortDate(lastVisitDate)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93] block">누적 수거량</span>
            <span className="text-xs font-bold text-[#315C36] dark:text-[#34C759] font-display-metric mt-0.5 block">
              {totalCollectedKg.toLocaleString('ko-KR')}kg
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93] block">총 측정 횟수</span>
            <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5 block">
              {records.length}회
            </span>
          </div>
        </div>
      </Card>

      {/* 2. 빠른 측정 CTA 버튼 (측정은 회사가 한다) */}
      {!isManager && (
      <Button
        variant="primary"
        size="lg"
        icon="edit_note"
        onClick={handleStartMeasurement}
        className="shadow-xs"
      >
        이 장소 바로 측정하기
      </Button>
      )}

      {/* 3. 함수율 추이 차트 (MoistureChart) */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-[#6E6E73] dark:text-[#8E8E93] px-1">
          함수율 추이 그래프
        </h3>
        <MoistureChart records={records} />
      </div>

      {/* 4. 기록 이력 리스트 (PileRecordList) */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-[#6E6E73] dark:text-[#8E8E93] px-1">
          기록 이력 ({allRecords.length}건 · 측정 {records.length}건)
        </h3>
        <PileRecordList records={allRecords} />
      </div>
    </div>
  );
};
