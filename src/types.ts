/**
 * 커피박 부숙 관리 시스템 통합 타입 정의
 *
 * 운영 방식: 관리자가 주 2~3회 목장을 방문해 [곰팡이 확인 → 심부 3지점 측정 → 혼합 →
 * 신규 투입·깔개 사용 확인 → 사진 → 저장] 을 한다. 기록 한 건 = 현장 방문 한 번이다.
 *
 * 중요: 건준목장은 한 구역에 커피박을 계속 모으고 기존 커피박과 섞어 관리한다.
 * 따라서 측정값은 "그 시점의 전체 혼합 더미 상태"이지, 특정 주차 커피박의 부숙 경과가 아니다.
 * 앞뒤 기록을 같은 커피박의 변화라고 말하면 안 된다.
 */

/**
 * - first: 그 장소의 첫 기록 — 비교할 이전 값이 없어 판정하지 않는다
 * - action_needed: 과열·과습 — 혼합 조치가 먼저
 * - drying: 함수율이 사용 기준보다 높음 — 부숙 진행 중
 * - usable: 함수율이 현장 관찰 범위 안 — 깔개 사용 후보
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

/**
 * 곰팡이 육안 상태. 예전 기록에는 없으므로 undefined 는 "기록 없음"이다.
 * 없는 값을 '없음'으로 추정하지 않는다.
 */
export type MoldStatus = 'none' | 'some' | 'spreading';

/** 최근 측정값의 움직임 — 코드에서 계산한다 (AI 가 아니다) */
export type TrendDirection = 'decreasing' | 'increasing' | 'steady' | 'unknown';

/**
 * 깔개 사용 판단 4단계 + 예외 2가지.
 * - accumulating: 축적 중 (목표량보다 한참 적음)
 * - managing: 관리 중 (모으면서 온도·함수율 관리)
 * - preparing: 사용 준비 (목표량 근접 + 건조·안정 방향)
 * - candidate: 사용 후보 (목표량 도달 + 관찰 범위 접근 + 혼합 정상 + 곰팡이 없음)
 * - attention: 관리 필요 (혼합이 밀렸거나 과열·과습)
 * - hold: 사용 보류 (곰팡이 발견 또는 자료 부족)
 */
export type BeddingStage = 'accumulating' | 'managing' | 'preparing' | 'candidate' | 'attention' | 'hold';

/** 더미 한 지점의 심부 측정값 */
export interface CorePoint {
  coreTemp: number;   // ℃
  moisture: number;   // %
}

/** 현장 방문 기록 한 건 = 구글 시트 한 행 */
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
  /** 3지점 평균 심부 온도 */
  coreTemp: number;       // ℃
  /** 3지점 평균 심부 함수율 */
  moisture: number;       // %
  /** 같은 높이에서 30cm 간격으로 잰 지점별 값 (평균의 근거). 예전 기록에는 없다. */
  corePoints?: CorePoint[];
  ambientTemp: number;    // ℃
  ambientHum: number;     // %
  /** 현장 특이사항 (교반 실시, 침출수 발생 등) */
  notes?: string;
  /** 파봉 작업 사진 (드라이브에 올라간 것) */
  photos?: RecordPhoto[];
  /** 아직 드라이브에 못 올리고 이 기기에 보관 중인 사진 수 (시트로 보내지 않는 로컬 값) */
  pendingPhotoCount?: number;

  /* ── 현장 방문 기록 (v13~). 예전 기록에는 없으므로 모두 선택 항목이다. ── */

  /**
   * 이번 방문에 새로 부은 커피박(kg).
   * 예전 기록의 collectedKg 와 같은 뜻이라 새 기록은 두 칸에 같은 값을 넣는다.
   */
  addedKg?: number;
  /** 이번 방문에 깔개로 퍼 간 커피박(kg) */
  beddingUsedKg?: number;
  /** 깔개 활용 사용처 (예: 1번 우사, 송아지방) */
  beddingLocation?: string;
  /** 대략적인 깔개 사용량 표현 (예: 1/2, 2/1 등) */
  beddingAmountDesc?: string;
  /** 기록 종류: 현장 점검('inspection') vs 수거·파봉 측정('measurement') */
  recordType?: 'inspection' | 'measurement';
  /** 오늘 혼합 작업(기존 커피박을 삽으로 한 번씩 뒤집기)을 했는지 */
  mixed?: boolean;
  /** 곰팡이 육안 상태 */
  moldStatus?: MoldStatus;
  /** 곰팡이 유무 (현장 점검 시 명시적 선택) */
  hasMold?: boolean;
  /** 곰팡이 색상 (예: 흰색, 녹색, 검은색 등) */
  moldColor?: string;
  /** 이상 냄새가 났는지 */
  odor?: boolean;
  /** 이 기록이 속한 운영 사이클 ID (예: GJ-2026-09-01) */
  cycleId?: string;
}

/** 목장 + 하역 장소 = 하나의 더미 */
export interface Pile {

  ranchName: string;
  location: string;
}

export interface CompostSettings {
  /**
   * 깔개 사용 후보로 보는 함수율 하한(%).
   * 건준목장 현장 관찰값(부숙·건조가 정상이면 3~4주 뒤 20~30%)에서 온 값이며,
   * 아직 실증 데이터가 충분하지 않아 확정 기준이 아니다.
   */
  usableMoistureMin: number;
  /** 깔개 사용 후보로 보는 함수율 상한(%) */
  usableMoistureMax: number;
  highMoistureThreshold: number;    // 기본 65% (초과 시 혼합 필요)
  highTempThreshold: number;        // 기본 65℃ (초과 시 혼합 필요)
  /** 심부온도 측정 깊이(cm) */
  coreProbeDepthCm: number;
  /**
   * 목장별 깔개 목표량(kg). 확정된 값이 아니라 목장마다 사람이 정한다.
   * 값이 없으면 화면에서 "깔개 목표량을 설정해주세요" 로 안내한다.
   */
  beddingTargetKg: Record<string, number>;
  /**
   * 기본 톱밥 단가(원/톤). 목장별 단가를 넣지 않은 목장에 쓴다.
   * 톱밥 절감액 = min(월 소요량 × 50%, 들어온 커피박) × 단가.
   */
  sawdustPricePerTon: number;
  /** 목장별 톱밥 구매 단가(원/톤). 목장마다 구매처·운송비가 달라 따로 정한다. */
  sawdustPriceByRanch: Record<string, number>;
  /** 목장별 월 톱밥 소요량(톤) — 사람이 넣는다. 없으면 톱밥 절감액을 셈하지 않는다. */
  sawdustMonthlyTonsByRanch: Record<string, number>;
  /** 저장된 설정의 판(version). 기준값의 뜻이 바뀌면 올려서 한 번만 맞춘다. */
  settingsVersion?: number;
}

/** 목장 한 곳의 운영 사이클 — 커피박을 모아 깔개로 쓰기까지의 기간 */
export interface OperatingCycle {
  /** 사이클 ID. 사람이 시작한 적이 없고 예전 기록만 있으면 null */
  id: string | null;
  /** 이 사이클의 첫 날 (YYYY-MM-DD) */
  startDate: string;
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

export type ActiveTab = 'today' | 'inspection' | 'monitoring' | 'history' | 'simulation' | 'assistant' | 'impact' | 'settings' | 'data_management';

export interface ToastMessage {
  id: string;
  title: string;
  sub?: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}
