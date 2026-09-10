/**
 * 커피박 부숙 관리 시스템 통합 타입 정의
 */

export type VerdictType = 'ready' | 'ongoing' | 'action_needed';

export interface VerdictInfo {
  type: VerdictType;
  title: string;
  subtitle: string;
  icon: string;
  badgeText: string;
  bannerClass: string;
  titleClass: string;
  iconClass: string;
}

export type BatchStatus = 'fermenting' | 'completed' | 'hold';

export interface Batch {
  id: string;
  code: string;           // e.g., '건준목장-260820-1'
  ranchName: string;      // e.g., '건준목장 (본장)'
  startDate: string;      // YYYY-MM-DD (반입일)
  completedDate?: string; // YYYY-MM-DD (완숙 완료일). 완료 배치의 부숙 기간을 고정하는 데 쓴다.
  initialWeightKg: number;
  status: BatchStatus;
  notes?: string;
}

export interface MeasurementLog {
  id: string;
  batchId: string;
  dayNumber: number;      // D+14
  date: string;           // YYYY-MM-DD
  time: string;           // HH:mm
  coreTemp: number;       // ℃
  moisture: number;       // %
  ambientTemp: number;    // ℃
  ambientHum: number;     // %
  /** 직전 계측 대비 심부온도 변화(℃). 첫 계측이면 없음. 부숙 진행은 이 추이로 판단한다. */
  coreTempDelta?: number;
  verdict: VerdictType;
  /** 현장 특이사항 (교반 실시, 침출수 발생 등). 시트의 비고 열에 기록된다. */
  notes?: string;
}

export interface CompostSettings {
  targetMoistureThreshold: number;  // 기본 45% (이하 시 적합)
  highMoistureThreshold: number;    // 기본 65% (초과 시 교반 필요)
  highTempThreshold: number;        // 기본 65℃ (초과 시 교반 필요)
  /** 심부온도 측정 깊이(cm). 현장 기준이 바뀌면 설정에서 조정한다. */
  coreProbeDepthCm: number;
}

export interface GoogleSheetsConfig {
  sheetWebhookUrl: string;
  autoSync: boolean;
  lastSyncTime?: string;
  lastSyncStatus?: 'success' | 'error' | 'idle' | 'unverified';
  lastSyncMessage?: string;
  totalSyncedCount?: number;
  /** 마지막으로 확인된 Apps Script 버전 (구버전은 1) */
  scriptVersion?: number;
}

export type GoogleSyncEventType = 'measurement' | 'bulk_measurements' | 'batch_created' | 'batch_completed' | 'batch_updated' | 'test';

export interface BatchSyncPayload {
  eventType: 'batch_created' | 'batch_completed' | 'batch_updated';
  timestamp: string;
  batchCode: string;
  ranchName: string;
  startDate: string;
  initialWeightKg: number;
  status: BatchStatus;
  notes?: string;
}

export type ActiveTab = 'monitoring' | 'history' | 'settings';

export interface ToastMessage {
  id: string;
  title: string;
  sub?: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}
