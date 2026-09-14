/**
 * 커피박 부숙 관리 시스템 통합 타입 정의
 *
 * 운영 방식: 매주 [하역 장소 선택 → 수거량 → 심부 온도·함수율 → 외기 온도·습도 → 저장].
 * 목장 + 하역 장소가 곧 하나의 더미이고, 같은 장소의 기록을 시간순으로 비교해
 * 깔개로 쓸 시점(함수율 기준 범위)을 안내한다.
 */

/**
 * - first: 그 장소의 첫 기록 — 비교할 이전 값이 없어 판정하지 않는다
 * - action_needed: 과열·과습 — 혼합 조치가 먼저
 * - drying: 함수율이 사용 기준보다 높음 — 부숙 진행 중
 * - usable: 함수율이 사용 기준 범위 안 — 깔개 사용 가능
 * - too_dry: 함수율이 사용 기준보다 낮음
 */
export type VerdictType = 'first' | 'action_needed' | 'drying' | 'usable' | 'too_dry';

export interface VerdictInfo {
  type: VerdictType;
  title: string;
  /** 판정 근거 (지난 기록 대비 변화 등) */
  subtitle: string;
  /** 이어서 할 작업 안내 */
  action: string;
  /** 깔개 사용 가능 시점 예상 (함수율이 기준보다 높고 줄어드는 중일 때만) */
  timing?: string;
  icon: string;
  bannerClass: string;
  titleClass: string;
  iconClass: string;
}

/** 구글 드라이브에 올라간 현장 사진 */
export interface RecordPhoto {
  fileId: string;
  /** 드라이브 보기 링크 */
  url: string;
}

/** 주간 현장 기록 한 건 = 구글 시트 한 행 */
export interface MeasurementRecord {
  /** 레코드 키 (목장|장소|날짜). 같은 장소·같은 날짜는 한 건만 남는다. */
  id: string;
  ranchName: string;
  /** 실제 커피박 하역 장소 (세부 장소) */
  location: string;
  date: string;           // YYYY-MM-DD (측정일)
  time: string;           // HH:mm
  /** 이번에 하역한 커피박 수거량(kg). 추가 하역이 없으면 0 */
  collectedKg: number;
  coreTemp: number;       // ℃
  moisture: number;       // %
  ambientTemp: number;    // ℃
  ambientHum: number;     // %
  /** 현장 특이사항 (교반 실시, 침출수 발생 등) */
  notes?: string;
  /** 파봉 작업 사진 (드라이브에 올라간 것) */
  photos?: RecordPhoto[];
  /** 아직 드라이브에 못 올리고 이 기기에 보관 중인 사진 수 (시트로 보내지 않는 로컬 값) */
  pendingPhotoCount?: number;
}

/** 목장 + 하역 장소 = 하나의 더미 */
export interface Pile {
  ranchName: string;
  location: string;
}

export interface CompostSettings {
  /** 깔개 사용 가능 함수율 하한(%) */
  usableMoistureMin: number;
  /** 깔개 사용 가능 함수율 상한(%) */
  usableMoistureMax: number;
  highMoistureThreshold: number;    // 기본 65% (초과 시 혼합 필요)
  highTempThreshold: number;        // 기본 65℃ (초과 시 혼합 필요)
  /** 심부온도 측정 깊이(cm) */
  coreProbeDepthCm: number;
}

export interface GoogleSheetsConfig {
  sheetWebhookUrl: string;
  lastSyncTime?: string;
  lastSyncStatus?: 'success' | 'error' | 'idle' | 'unverified';
  lastSyncMessage?: string;
  totalSyncedCount?: number;
  /** 마지막으로 확인된 Apps Script 버전 (구버전은 1) */
  scriptVersion?: number;
}

export type ActiveTab = 'monitoring' | 'history' | 'settings';

export interface ToastMessage {
  id: string;
  title: string;
  sub?: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}
