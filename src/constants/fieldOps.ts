/**
 * 현장 운영 기준값.
 *
 * 건준목장은 한 구역에 커피박을 계속 모으고 기존 커피박과 섞어 관리한다.
 * 그래서 아래 값들은 "이 더미를 지금 어떻게 관리하고 있는가"를 보는 기준이지,
 * 특정 커피박 한 묶음의 부숙 기간을 재는 값이 아니다.
 *
 * 아직 실증 데이터가 충분하지 않아 임시로 잡아 둔 값이므로 여기 모아 둔다.
 * 실제 사용 기록이 쌓이면 이 값부터 고친다.
 */
export const FIELD_OPS = {
  /** 혼합 횟수를 세는 기간(일) */
  mixingWindowDays: 7,
  /** 이 기간 동안 최소 이만큼은 혼합한다 (곰팡이 예방) */
  mixingWeeklyMin: 2,
  /** 목표 상한 — 넘겼다고 문제로 보지는 않는다 */
  mixingWeeklyMax: 3,
  /** 마지막 혼합 이후 이만큼 지나면 확인 안내를 띄운다 */
  mixingStaleDays: 4,
  /** 마지막 방문 이후 이만큼 지나면 현장 점검을 권한다 */
  visitIntervalDays: 3,
  /** 추세를 볼 때 쓰는 최근 측정 횟수 */
  trendPoints: 3,
  /** 함수율이 이보다 적게 움직였으면 '유지'로 본다 (%p) */
  moistureSteadyBand: 2,
  /** 심부 온도가 이보다 적게 움직였으면 '유지'로 본다 (℃) */
  tempSteadyBand: 3,
  /** 목표량의 이 비율을 넘기면 '근접'으로 본다 */
  targetNearRatio: 0.8,
  /** 사용 후보 판정에서 함수율이 관찰 범위 상한보다 이만큼까지는 '접근'으로 본다 (%p) */
  moistureApproachBand: 3,
  /** 직전 측정보다 함수율이 이만큼 이상 오르면 급상승으로 본다 (%p) */
  moistureJumpPoint: 8,
  /** 직전 측정보다 심부 온도가 이만큼 이상 오르면 급상승으로 본다 (℃) */
  tempJumpDeg: 10,
  /** 마지막 방문 이후 이만큼 지나면 이상 신호 점검에서 '경고'로 올린다 */
  visitOverdueDays: 7,
  /** 이 기간 안의 신규 투입만 '투입 이후 변화'로 살핀다 (일) */
  recentInputDays: 14,
} as const;

/** 목장 이름 → 사이클 ID 앞글자 */
const RANCH_CODES: Record<string, string> = {
  건준목장: 'GJ',
  다원목장: 'DW',
};

/** 'GJ-2026-09-16' 같은 운영 사이클 ID */
export function makeCycleId(ranchName: string, startDate: string): string {
  return `${RANCH_CODES[ranchName.trim()] ?? 'FARM'}-${startDate}`;
}
