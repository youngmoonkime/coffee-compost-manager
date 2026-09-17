/**
 * 자원순환 임팩트 — 환산 계수와 현장 실증 기록.
 *
 * 숫자마다 근거 수준이 다르다. 화면에는 근거 수준을 함께 밝힌다.
 * - 탄소: 외부 참고 계수 (국가 승인 배출계수 아님) → '참고 추정'
 * - 톱밥: 설정의 목장별 톤 단가로 앱이 계산 → '계산'
 * - 악취: 2025 시범사업 최종성과보고서의 결과 요약 → '현장 실증'
 */

/** 커피박 소각 배출 회피 참고 계수 (kgCO₂ / kg-커피박) — 커피박 1톤 소각 시 약 338kgCO₂ */
export const COFFEE_GROUNDS_INCINERATION_CO2_PER_KG = 0.338;

export const CARBON_FACTOR_NOTE = {
  basis: '커피박 1톤을 소각할 때 약 338kgCO₂ 배출 (0.338kgCO₂/kg)',
  source: '커피찌꺼기 재활용 정보 페이지 등 외부 자료에서 반복 인용되는 참고값',
  limits: [
    '산정 방법과 원자료가 명확히 제시된 국가 승인 배출계수가 아닙니다.',
    '수거한 커피박 전량이 소각되지 않고 자원화됐다고 가정한 값입니다.',
    '운송·전처리 과정의 배출량은 반영하지 않았습니다.',
    '공식 탄소감축 인증이 아닌 사업 성과보고용 참고 추정치입니다.',
  ],
  /** 2025 최종성과보고서의 연간 재활용량 적용 예 */
  example: { label: '2025년 재활용 23,132kg', kg: 23_132 },
} as const;

/** 2025 커피박 활용 악취저감 실천 시범사업 — 제주 다원목장 암모니아 전후 측정 */
export const ODOR_FIELD_RECORD = {
  site: '제주 다원목장 실내축사',
  installed: '2025년 7월 ICT 악취측정 장비 설치',
  bedding: '커피박 50% + 톱밥 50%',
  gas: '암모니아(NH₃)',
  unit: 'ppm',
  before: 0.59,
  after: 0.34,
  /** 보고서 표기 */
  reportedReductionPercent: 42,
  source: '2025년 커피박 활용 악취저감 실천 시범사업 최종성과보고서 (3쪽 장비 설치, 4쪽 전후 측정, 18쪽 최종 분석)',
  limits: [
    '보고서의 결과 요약 기록입니다. 측정 일시·기간·횟수, 센서 제조사·모델, 검교정 기록, 설치 위치, 온습도·환기 상태, 원본 데이터는 확인되지 않았습니다.',
    '공인 시험기관 성적서 수준의 실증 자료가 아닙니다.',
    '복합악취·황화수소는 이 목장에서 측정한 값이 없습니다. 다른 연구 기관의 사례 수치는 이 목장의 결과로 쓰지 않습니다.',
  ],
} as const;

export function odorReductionPercent(): number {
  const { before, after } = ODOR_FIELD_RECORD;
  return before > 0 ? Math.round(((before - after) / before) * 1000) / 10 : 0;
}
