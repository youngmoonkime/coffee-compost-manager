import type { Batch, CompostSettings, MeasurementLog } from '../types';

export const DEFAULT_SETTINGS: CompostSettings = {
  targetMoistureThreshold: 45,
  targetTempDiffThreshold: 10,
  highMoistureThreshold: 65,
  highTempThreshold: 65,
};

/**
 * 앱은 빈 상태로 시작한다.
 * 예전에는 '건준목장-260820-1' 같은 예시 배치가 미리 들어 있었는데,
 * 실제로 입력한 현장 기록과 섞여서 어떤 게 진짜 데이터인지 구분되지 않았다.
 * 첫 배치는 [새 하역 등록]으로 직접 만든다.
 */
export const DEFAULT_BATCHES: Batch[] = [];

export const DEFAULT_MEASUREMENTS: MeasurementLog[] = [];
