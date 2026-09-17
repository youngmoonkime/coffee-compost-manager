import React from 'react';
import { MeasurementFlow } from '../measurement/MeasurementFlow';

/**
 * 현장 점검 기록 화면: 장소 → 혼합·곰팡이·악취·깔개 점검 → 심부 3지점 → 외기 환경 → 저장.
 * 수거·파봉 측정은 [측정 기록] 탭에서 따로 진행한다.
 */
export const InspectionView: React.FC = () => (
  <div className="flex flex-col w-full pb-8">
    <MeasurementFlow mode="inspection" />
  </div>
);
