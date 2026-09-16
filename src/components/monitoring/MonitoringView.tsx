import React from 'react';
import { MeasurementFlow } from '../measurement/MeasurementFlow';

/**
 * 측정 기록 탭은 입력에만 집중한다: 장소 → 수거량 → 심부 → 외기 → 사진 → 저장.
 * 함수율 추이와 지난 기록은 저장 후 결과 화면과 [장소별 현황]에서 본다.
 */
export const MonitoringView: React.FC = () => (
  <div className="flex flex-col w-full pb-8">
    <MeasurementFlow />
  </div>
);

