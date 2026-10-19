import type { CompostSettings } from '../types';
import { SAWDUST_SAVING_RATE, SAWDUST_TONS_PER_COFFEE_TON } from '../constants/defaultData';
import { normalizeName } from './calculations';

/**
 * 톱밥 구매비 절감 추정.
 *
 * 깔개는 바닥면적 × 두께(부피)로 깔고 톱밥은 무게로 사므로, 커피박을 같은 부피의 톱밥으로 바꿔 셈한다.
 * 중량 1:1 로 맞추면 절감액이 크게 부풀려진다 (커피박이 톱밥보다 약 3.7배 무겁다).
 * - 커피박이 대체하는 톱밥 = 들어온 커피박(톤) × 178/650 (≒ 0.27)
 * - 줄일 수 있는 톱밥 = 목장의 월 톱밥 소요량 × 50% (커피박 50% + 톱밥 50% 혼합 한도)
 * - 실제로 줄어드는 톱밥 = min(줄일 수 있는 톱밥, 커피박이 대체하는 톱밥)
 * - 절감액 = 실제로 줄어드는 톱밥(톤) × 톱밥 단가(원/톤)
 */

export interface SawdustPrice {
  pricePerTon: number;
  /** ranch = 목장별로 입력한 단가, default = 기본 단가 */
  priceSource: 'ranch' | 'default';
}

export interface SawdustSavingResult extends SawdustPrice {
  ranchName: string;
  /** 목장의 월 톱밥 소요량(톤). 설정에 없으면 null — 절감액을 셈하지 않는다 */
  monthlyTons: number | null;
  /** 그달 들어온 커피박(톤) */
  coffeeTons: number;
  /** 들어온 커피박과 같은 부피의 톱밥(톤) */
  equivalentSawdustTons: number;
  /** 소요량 × 절감률 — 커피박으로 줄일 수 있는 최대 톱밥(톤) */
  replaceableTons: number | null;
  /** 실제로 줄어드는 톱밥(톤) */
  savedTons: number | null;
  /** 월 톱밥 구매 지출(원) = 소요량 × 단가 */
  monthlySpendKrw: number | null;
  /** 절감액(원). 소요량이 없으면 null */
  savingKrw: number | null;
  /** 절감액을 막은 쪽 — demand: 소요량의 50% 까지 / coffee: 들어온 커피박이 더 적음 */
  limitedBy: 'demand' | 'coffee' | null;
  ratePercent: number;
  /** 커피박 1톤이 대체하는 톱밥(톤) */
  sawdustPerCoffeeTon: number;
}

export function sawdustPriceOf(settings: CompostSettings, ranchName: string): SawdustPrice {
  const own = settings.sawdustPriceByRanch?.[normalizeName(ranchName)];
  return own && own > 0
    ? { pricePerTon: own, priceSource: 'ranch' }
    : { pricePerTon: settings.sawdustPricePerTon, priceSource: 'default' };
}

/** 숫자만으로 셈한 절감 — 시뮬레이터처럼 목장 설정과 묶이지 않은 곳에서 쓴다 */
export function sawdustSavingFromAmounts({
  monthlyTons,
  coffeeKg,
  pricePerTon,
}: {
  monthlyTons: number | null;
  coffeeKg: number;
  pricePerTon: number;
}): {
  savedTons: number;
  savingKrw: number;
  replaceableTons: number;
  equivalentSawdustTons: number;
  limitedBy: 'demand' | 'coffee';
} | null {
  if (!monthlyTons || monthlyTons <= 0) return null;
  const equivalentSawdustTons = equivalentSawdustTonsOf(coffeeKg);
  const replaceableTons = monthlyTons * SAWDUST_SAVING_RATE;
  const savedTons = Math.min(replaceableTons, equivalentSawdustTons);
  return {
    savedTons,
    replaceableTons,
    equivalentSawdustTons,
    savingKrw: Math.round(savedTons * Math.max(0, pricePerTon)),
    limitedBy: equivalentSawdustTons < replaceableTons ? 'coffee' : 'demand',
  };
}

/** 커피박(kg)과 같은 부피의 톱밥(톤) */
export function equivalentSawdustTonsOf(coffeeKg: number): number {
  return (Math.max(0, coffeeKg) / 1000) * SAWDUST_TONS_PER_COFFEE_TON;
}

export function computeSawdustSaving(
  settings: CompostSettings,
  ranchName: string,
  coffeeKg: number
): SawdustSavingResult {
  const ranch = normalizeName(ranchName);
  const price = sawdustPriceOf(settings, ranch);
  const rawMonthly = settings.sawdustMonthlyTonsByRanch?.[ranch];
  const monthlyTons = rawMonthly && rawMonthly > 0 ? rawMonthly : null;
  const coffeeTons = Math.max(0, coffeeKg) / 1000;
  const ratePercent = Math.round(SAWDUST_SAVING_RATE * 100);
  const equivalentSawdustTons = equivalentSawdustTonsOf(coffeeKg);
  const sawdustPerCoffeeTon = SAWDUST_TONS_PER_COFFEE_TON;

  if (monthlyTons === null) {
    return {
      ranchName: ranch,
      ...price,
      monthlyTons: null,
      coffeeTons,
      equivalentSawdustTons,
      replaceableTons: null,
      savedTons: null,
      monthlySpendKrw: null,
      savingKrw: null,
      limitedBy: null,
      ratePercent,
      sawdustPerCoffeeTon,
    };
  }

  const amounts = sawdustSavingFromAmounts({ monthlyTons, coffeeKg, pricePerTon: price.pricePerTon });
  return {
    ranchName: ranch,
    ...price,
    monthlyTons,
    coffeeTons,
    equivalentSawdustTons,
    replaceableTons: amounts?.replaceableTons ?? null,
    savedTons: amounts?.savedTons ?? null,
    monthlySpendKrw: Math.round(monthlyTons * price.pricePerTon),
    savingKrw: amounts?.savingKrw ?? null,
    limitedBy: amounts?.limitedBy ?? null,
    ratePercent,
    sawdustPerCoffeeTon,
  };
}
