import React, { useState, useMemo, useCallback } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { ActiveBatchCard } from './ActiveBatchCard';
import { VerdictBanner } from './VerdictBanner';
import { MeasurementInputGrid } from './MeasurementInputGrid';
import { MoistureChart } from './MoistureChart';
import { MeasurementHistoryList } from './MeasurementHistoryList';
import { UnloadBatchModal } from './UnloadBatchModal';
import { evaluateFermentation } from '../../utils/calculations';

export const MonitoringView: React.FC = () => {
  const { currentVerdict, settings } = useCompost();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 인풋 입력 중 실시간 판정 오버라이드
  const [liveValues, setLiveValues] = useState<{
    coreTemp: number;
    ambientTemp: number;
    moisture: number;
  } | null>(null);

  const displayVerdict = useMemo(() => {
    if (liveValues) {
      return evaluateFermentation(liveValues.coreTemp, liveValues.moisture, settings);
    }
    return currentVerdict;
  }, [liveValues, settings, currentVerdict]);

  // 자식(MeasurementInputGrid)의 useEffect 의존성이 되므로 반드시 참조가 고정되어야 하며,
  // 값이 실제로 바뀌었을 때만 새 객체를 만들어 불필요한 리렌더를 차단한다.
  const handleLiveChange = useCallback(
    (coreTemp: number, ambientTemp: number, moisture: number) => {
      setLiveValues(prev => {
        if (
          prev &&
          prev.coreTemp === coreTemp &&
          prev.ambientTemp === ambientTemp &&
          prev.moisture === moisture
        ) {
          return prev;
        }
        return { coreTemp, ambientTemp, moisture };
      });
    },
    []
  );

  const handleOpenUnloadModal = useCallback(() => setIsModalOpen(true), []);
  const handleCloseUnloadModal = useCallback(() => setIsModalOpen(false), []);

  return (
    <div className="flex flex-col w-full pb-8">
      {/* 1. 작업 관리 배치 요약 및 하역 등록 */}
      <ActiveBatchCard onOpenUnloadModal={handleOpenUnloadModal} />

      {/* 2. 실시간 부숙 판정 HUD 배너 */}
      <VerdictBanner currentVerdict={displayVerdict} />

      {/* 3. 현장 실측값 입력 패드 */}
      <MeasurementInputGrid onLiveChange={handleLiveChange} />

      {/* 4. 심부 함수율 추이 동적 SVG 차트 */}
      <MoistureChart />

      {/* 5. 최근 계측 기록 리스트 */}
      <MeasurementHistoryList />

      {/* 6. 새 하역 등록 바텀시트 모달 */}
      <UnloadBatchModal isOpen={isModalOpen} onClose={handleCloseUnloadModal} />
    </div>
  );
};
