import React from 'react';
import type { MeasurementRecord, VerdictInfo } from '../../types';
import type { SaveRecordResult } from '../../contexts/CompostContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { MetricDisplay } from '../ui/MetricDisplay';

interface MeasurementResultProps {
  record: MeasurementRecord;
  verdict: VerdictInfo;
  sheet: SaveRecordResult['sheet'];
  photosUploaded: number;
  photosPending: number;
  previousRecord?: MeasurementRecord;
  onMeasureAnother: () => void;
  onViewLocationDetail: () => void;
}

const SHEET_STATUS_CONFIG: Record<
  SaveRecordResult['sheet'],
  { icon: string; text: string; color: string }
> = {
  synced: { icon: 'cloud_done', text: '구글 시트에 즉시 동기화됨', color: 'text-[#34C759]' },
  unverified: { icon: 'cloud_sync', text: '시트로 전송함 (반영 확인 중)', color: 'text-[#FF9F0A]' },
  failed: { icon: 'cloud_off', text: '시트 전송 실패 — 기기에 안전하게 보관됨', color: 'text-[#FF9F0A]' },
  skipped: { icon: 'smartphone', text: '이 기기에 저장됨 (시트 미연동)', color: 'text-[#6E6E73]' },
};

export const MeasurementResult: React.FC<MeasurementResultProps> = ({
  record,
  verdict,
  sheet,
  photosUploaded,
  photosPending,
  previousRecord,
  onMeasureAnother,
  onViewLocationDetail,
}) => {
  const sheetStatus = SHEET_STATUS_CONFIG[sheet];
  const diffMoisture = previousRecord ? Number((record.moisture - previousRecord.moisture).toFixed(1)) : undefined;

  return (
    <div className="space-y-4 pb-6">
      {/* 1. 상단 성공 및 장소 헤더 */}
      <div className="text-center pt-2">
        <div className="w-12 h-12 rounded-full bg-[#E7F0E6] dark:bg-[#315C36]/30 text-[#315C36] dark:text-[#34C759] flex items-center justify-center mx-auto mb-2 shadow-xs">
          <span className="material-symbols-outlined text-[28px]">check</span>
        </div>
        <span className="text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93]">측정 완료</span>
        <h2 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mt-0.5">
          {record.ranchName} · {record.location}
        </h2>
      </div>

      {/* 2. 현재 상태 & 판정 카드 */}
      <Card className="p-4 sm:p-5 border-l-4 border-l-[#315C36] dark:border-l-[#34C759]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-bold text-[#6E6E73] dark:text-[#8E8E93]">현재 판정</span>
          <StatusBadge type={verdict.type} />
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <MetricDisplay
            label="현재 함수율"
            value={record.moisture}
            unit="%"
            diff={diffMoisture}
            size="lg"
          />

          <div className="text-right">
            <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93] block mb-1">심부 온도</span>
            <span className="font-display-metric text-xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
              {record.coreTemp}℃
            </span>
          </div>
        </div>

        {/* 권장 행동 안내 박스 */}
        <div className="mt-4 p-3 rounded-xl bg-[#F2F2F7] dark:bg-[#2C2C2E] flex items-start gap-2.5">
          <span className="material-symbols-outlined text-[20px] text-[#315C36] dark:text-[#34C759] shrink-0 mt-0.5">
            tips_and_updates
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
      </Card>

      {/* 3. 보조 상태: 구글 시트 동기화 상태 */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-[#6E6E73] dark:text-[#8E8E93] py-1">
        <span className={`material-symbols-outlined text-[16px] ${sheetStatus.color}`}>
          {sheetStatus.icon}
        </span>
        {photosUploaded > 0 && (
          <span className="text-[#34C759] font-medium ml-1">
            (사진 {photosUploaded}장 전송됨)
          </span>
        )}
        {photosPending > 0 && (
          <span className="text-[#FF9F0A] font-medium ml-1">
            (사진 {photosPending}장 대기 중)
          </span>
        )}
      </div>


      {/* 4. 액션 버튼 */}
      <div className="space-y-2 pt-2">
        <Button variant="primary" size="lg" icon="refresh" onClick={onMeasureAnother} fullWidth>
          다른 장소 측정하기
        </Button>
        <Button variant="secondary" size="lg" icon="dataset" onClick={onViewLocationDetail} fullWidth>
          이 장소 상세 보기
        </Button>
      </div>
    </div>
  );
};
