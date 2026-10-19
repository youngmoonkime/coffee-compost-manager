/**
 * 자원순환 임팩트 — 환산 계수와 현장 실증 기록.
 *
 * 숫자마다 근거 수준이 다르다. 화면에는 근거 수준을 함께 밝힌다.
 * - 탄소: 외부 참고 계수 (국가 승인 배출계수 아님) → '참고 추정'
 * - 톱밥: 커피박을 같은 부피의 톱밥으로 바꿔 설정의 목장별 톤 단가로 앱이 계산 → '계산'
 * - 악취: 2025 시범사업 최종성과보고서의 결과 요약 → '현장 실증'
 */

import {
  COFFEE_GROUNDS_BULK_DENSITY_KG_PER_M3,
  SAWDUST_BULK_DENSITY_KG_PER_M3,
  SAWDUST_TONS_PER_COFFEE_TON,
} from './defaultData';

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

/** 제주 톱밥 단가(원/kg) — 산출근거의 다원목장 적용값 */
const JEJU_SAWDUST_WON_PER_KG = 160;

/** 커피박(톤) → 같은 부피의 톱밥(톤) · 그 톱밥 값(원) */
function sawdustExample(coffeeTons: number, wonPerKg: number) {
  const sawdustTons = coffeeTons * SAWDUST_TONS_PER_COFFEE_TON;
  return { sawdustTons, won: sawdustTons * 1000 * wonPerKg };
}

const fmtOne = (n: number) => n.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** 원 → "140만" (10만 원 단위 반올림) */
const fmtManwon = (won: number) => (Math.round(won / 100_000) * 10).toLocaleString('ko-KR') + '만';

/** 화면·문서에 쓰는 환산 숫자 — 밀도 상수만 바꾸면 모두 따라 바뀐다 */
export const SAWDUST_BASIS = {
  /** 커피박 1톤이 대체하는 톱밥(톤), 예: "0.27" */
  ratioText: SAWDUST_TONS_PER_COFFEE_TON.toFixed(2),
  /** 커피박 1톤의 부피(㎥), 예: "1.5" */
  coffeeM3PerTonText: fmtOne(1000 / COFFEE_GROUNDS_BULK_DENSITY_KG_PER_M3),
  densityText: `톱밥 ${SAWDUST_BULK_DENSITY_KG_PER_M3}kg/㎥ · 커피박 ${COFFEE_GROUNDS_BULK_DENSITY_KG_PER_M3}kg/㎥`,
} as const;

const jejuPerTon = sawdustExample(1, JEJU_SAWDUST_WON_PER_KG);
const dawon = sawdustExample(31.9, JEJU_SAWDUST_WON_PER_KG);
const cheongyang = sawdustExample(30 * 12, 225);

/** 톱밥 대체 절감액 산출근거 — 부피 등가 기준 (선행 연구의 중량 1:1 가정을 보정) */
export const SAWDUST_FACTOR_NOTE = {
  densities: [
    `톱밥 용적중 ${SAWDUST_BULK_DENSITY_KG_PER_M3}kg/㎥ (축우 사육용 깔짚 물리적 특성 연구)`,
    `커피박 겉보기밀도 약 ${COFFEE_GROUNDS_BULK_DENSITY_KG_PER_M3}kg/㎥ (톤백 1㎥당 700~800kg 적재 기준, 현장 실측 예정)`,
  ],
  conversion:
    `커피박 1톤 ≒ ${SAWDUST_BASIS.coffeeM3PerTonText}㎥ ≒ 톱밥 약 ${SAWDUST_BASIS.ratioText}톤 대체 → ` +
    `톱밥 ${JEJU_SAWDUST_WON_PER_KG}원/kg(제주)이면 커피박 1톤당 약 ${fmtOne(jejuPerTon.won / 10_000)}만 원`,
  previousStudy:
    '선행 연구(제주 사회실험연구 보고서)의 "톤당 8만 원 절감(연 1,056만 원)"은 커피박 1톤이 톱밥 1톤을 대체한다는 중량 1:1 가정이고, ' +
    '연간 깔개 소요량의 50%(약 66톤) 대체를 전제해 실제 수거량(연 약 32톤)을 넘었습니다. 깔개는 부피로 깔고 비용은 kg 으로 내므로 부피 기준으로 다시 셈합니다.',
  perHead: [
    '한우(비육우): 두당 7㎡ · 두께 5cm · 30~40일 교체 → 연 3.5~4.0㎥/두 (톱밥 600~700kg/두)',
    '교차검증: 한우 300두 톱밥 교체비 연 3천만 원(150원/kg) → 두당 667kg',
    '젖소(착유우): 두께 10cm → 연 6~8㎥/두 (톱밥 1,100~1,400kg/두)',
  ],
  examples: [
    `제주 다원목장(커피박 연 31.9톤): 대체 톱밥 약 ${fmtOne(dawon.sawdustTons)}톤 × ${JEJU_SAWDUST_WON_PER_KG}원/kg → 연 약 ${fmtManwon(dawon.won)} 원`,
    `충남 청양 한우농가 900두(커피박 월 30톤): 대체 톱밥 약 ${fmtOne(cheongyang.sawdustTons)}톤 × 연평균 225원/kg(여름 150원·겨울 300원) → 연 약 ${fmtManwon(cheongyang.won)} 원`,
  ],
  limits: [
    '불확실성은 커피박 겉보기밀도와 실제 살포 두께에 몰려 있습니다.',
    '참여 목장에서 ① 커피박·톱밥 톤백의 실측 부피·중량 ② 1회 살포량 대비 바닥면적 환산 두께 ③ 톱밥 구매 전표 1년치를 받아 보완할 예정입니다.',
    '운송·처리비는 빼지 않았고, 실제 구매 절감을 보장하지 않습니다.',
  ],
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
