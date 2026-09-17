import type { CompostSettings } from '../types';
import { readEnvUrl } from '../utils/env';

/**
 * 설정의 판. 기준값의 "뜻"이 바뀌면 올린다.
 * 2: 깔개 사용 함수율이 현장 관찰값(20~30%)으로 바뀐 판.
 * 3: 기본 톱밥 단가가 120,000원/톤으로 바뀐 판.
 */
export const SETTINGS_VERSION = 3;

/** 기본 톱밥 단가(원/톤) — 목장별 단가를 넣지 않은 목장에 쓴다 */
export const DEFAULT_SAWDUST_PRICE_PER_TON = 120_000;

/** 예전 기본 단가 — 사람이 바꾸지 않은 채 저장돼 있으면 새 기본값으로 옮긴다 */
export const LEGACY_DEFAULT_SAWDUST_PRICE_PER_TON = 240_000;

/** 커피박을 깔개로 쓰면 톱밥 구매 지출이 줄어드는 비율 (50%) */
export const SAWDUST_SAVING_RATE = 0.5;

export const DEFAULT_SETTINGS: CompostSettings = {
  // 건준목장 현장 관찰: 부숙·건조가 정상이면 3~4주 뒤 20~30% 로 내려간다.
  // 확정 기준이 아니라 관찰값이므로 화면에도 "현장 관찰 기준" 으로 적는다.
  usableMoistureMin: 20,
  usableMoistureMax: 30,
  highMoistureThreshold: 65,
  highTempThreshold: 65,
  coreProbeDepthCm: 15,
  // 목표량은 목장마다 사람이 정한다 — 앱이 임의로 정하지 않는다
  beddingTargetKg: {},
  sawdustPricePerTon: DEFAULT_SAWDUST_PRICE_PER_TON,
  // 목장별 단가는 사람이 정한다 — 없으면 기본 단가를 쓴다
  sawdustPriceByRanch: {},
  // 목장별 월 톱밥 소요량(톤)은 사람이 정한다 — 축종·두수·계절에 따라 크게 다르다
  sawdustMonthlyTonsByRanch: {},
  settingsVersion: SETTINGS_VERSION,
};

/** 기록할 때 기본으로 잡히는 목장 */
export const DEFAULT_RANCH_NAME = '건준목장';

/** 환경변수가 없을 때 쓰는 부숙관리 주소 (지금까지 쓰던 배포본) */
const COMPOST_GAS_FALLBACK =
  'https://script.google.com/macros/s/AKfycbzoY_1P7sDrYz6Gx4cicZWB2ZdUPOmzDoYbBJ32LRL37sUv_GDfJG9T1FbepseZSDZB/exec';

/**
 * 부숙관리 구글 시트("커피박 부숙 관리 대장")의 Apps Script 웹 앱 주소.
 * 하는 일: 기록 불러오기·저장, 사진 업로드, AI 리포트 문장 만들기.
 * 수거관리 주소(VITE_COLLECTION_GAS_API_URL)와는 다른 시트다 — 절대 섞어 쓰지 않는다.
 *
 * .env.local 의 VITE_COMPOST_GAS_API_URL 을 먼저 보고, 없으면 위 주소를 쓴다.
 * 스크립트를 고칠 때는 [배포 관리 → 연필 → 새 버전]으로 배포해야 주소가 유지된다.
 */
export const COMPOST_GAS_API_URL = readEnvUrl('VITE_COMPOST_GAS_API_URL') || COMPOST_GAS_FALLBACK;

