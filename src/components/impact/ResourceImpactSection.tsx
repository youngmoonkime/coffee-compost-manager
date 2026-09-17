import { useCompost } from '../../contexts/CompostContext';
import { CARBON_FACTOR_NOTE, COFFEE_GROUNDS_INCINERATION_CO2_PER_KG } from '../../constants/impactFactors';
import { computeSawdustSaving } from '../../utils/sawdustSaving';
import { ImpactCard } from './ImpactCard';
import { OdorImpactCard } from './OdorImpactCard';

interface ResourceImpactSectionProps {
  /** 이번 달 매장 수거량 (수거관리 시트 실측) */
  collectedKg: number;
  /** 수거한 커피박을 받는 목장 (수거관리의 운영 목장) */
  receivingRanch: string | null;
  year: number;
  month: number;
  periodLabel: string;
  isPartialMonth: boolean;
}

function formatCo2(kg: number): string {
  return kg >= 1000
    ? `${(kg / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })} tCO₂`
    : `${Math.round(kg).toLocaleString('ko-KR')} kgCO₂`;
}

function formatWon(won: number): string {
  return won >= 10_000
    ? `${(won / 10_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만 원`
    : `${Math.round(won).toLocaleString('ko-KR')}원`;
}

/**
 * 자원순환 임팩트 — 탄소(참고 추정) · 톱밥 구매비(계산) · 악취(현장 실증).
 * 숫자는 모두 코드로 계산하고, 근거 수준과 한계를 ⓘ 에 밝힌다.
 */
export function ResourceImpactSection({ collectedKg, receivingRanch, year, month, periodLabel, isPartialMonth }: ResourceImpactSectionProps) {
  const { settings } = useCompost();
  const kg = Math.max(0, collectedKg);

  // 탄소 — 수거량 전량 자원화 가정
  const co2Kg = kg * COFFEE_GROUNDS_INCINERATION_CO2_PER_KG;
  const exampleCo2 = CARBON_FACTOR_NOTE.example.kg * COFFEE_GROUNDS_INCINERATION_CO2_PER_KG;

  // 톱밥 — min(받는 목장의 월 소요량 × 50%, 들어온 커피박) × 톤 단가
  const saw = computeSawdustSaving(settings, receivingRanch ?? '', kg);
  const ranch = saw.ranchName;
  const usesRanchPrice = saw.priceSource === 'ranch';
  const priceLabel = `${saw.pricePerTon.toLocaleString('ko-KR')}원/톤 (${usesRanchPrice ? `${ranch} 단가` : '기본 단가'})`;
  const fmtTons = (t: number) => t.toLocaleString('ko-KR', { maximumFractionDigits: 2 });

  const monthNote = isPartialMonth ? `${periodLabel} 현재까지` : periodLabel;

  return (
    <section className="collection-impact__impact" aria-label="자원순환 임팩트">
      <div className="collection-impact__impact-head">
        <h3>자원순환 임팩트</h3>
        <span>수거량으로 환산한 추정치와 현장 악취 측정 기록 · 항목별 근거는 ⓘ</span>
      </div>

      <div className="collection-impact__impact-grid">
        <ImpactCard
          badge="참고 추정"
          title="소각 배출 회피 (탄소)"
          value={formatCo2(co2Kg)}
          sub={`${monthNote} 수거 ${Math.round(kg).toLocaleString('ko-KR')}kg × ${COFFEE_GROUNDS_INCINERATION_CO2_PER_KG}kgCO₂/kg`}
          infoLabel="탄소 환산 근거"
          info={
            <>
              <p className="collection-impact__impact-note-line"><b>산정식</b> 수거량(kg) × {COFFEE_GROUNDS_INCINERATION_CO2_PER_KG}kgCO₂/kg</p>
              <p className="collection-impact__impact-note-line"><b>계수</b> {CARBON_FACTOR_NOTE.basis}</p>
              <p className="collection-impact__impact-note-line"><b>출처</b> {CARBON_FACTOR_NOTE.source}</p>
              <ul>
                {CARBON_FACTOR_NOTE.limits.map(line => <li key={line}>{line}</li>)}
              </ul>
              <p className="collection-impact__impact-note-line">
                <b>적용 예</b> {CARBON_FACTOR_NOTE.example.label} → 약 {formatCo2(exampleCo2)}
              </p>
            </>
          }
        />

        <ImpactCard
          badge="계산"
          title="톱밥 구매비 절감 (추정)"
          value={saw.savingKrw === null ? '소요량 입력 필요' : formatWon(saw.savingKrw)}
          sub={
            saw.savingKrw === null || saw.savedTons === null || saw.monthlyTons === null
              ? `설정 > 목장 설정에서 ${ranch || '목장'}의 월 톱밥 소요량을 넣으면 계산합니다`
              : `줄어든 톱밥 ${fmtTons(saw.savedTons)}톤 × ${priceLabel}`
          }
          infoLabel="톱밥 절감 근거"
          info={
            <>
              <p className="collection-impact__impact-note-line">
                <b>산정식</b> min(월 톱밥 소요량 × {saw.ratePercent}%, 들어온 커피박) × 톱밥 단가
              </p>
              <p className="collection-impact__impact-note-line">
                커피박을 깔개로 섞어 쓰면 톱밥 구매가 {saw.ratePercent}% 줄어든다고 봅니다. 커피박이 모자라면 들어온 만큼만,
                넘치면 소요량의 {saw.ratePercent}%까지만 인정합니다. 운송·처리비는 빼지 않았고, 실제 구매 절감을 보장하지 않습니다.
              </p>
              {saw.monthlyTons !== null && saw.replaceableTons !== null && saw.monthlySpendKrw !== null ? (
                <p className="collection-impact__impact-note-line">
                  <b>{ranch}</b> 월 소요량 {fmtTons(saw.monthlyTons)}톤(지출 {formatWon(saw.monthlySpendKrw)}) → 줄일 수 있는 톱밥{' '}
                  {fmtTons(saw.replaceableTons)}톤 · 들어온 커피박 {fmtTons(saw.coffeeTons)}톤
                  {saw.limitedBy === 'coffee' ? ' → 커피박이 적어 들어온 만큼만 반영' : ` → 소요량의 ${saw.ratePercent}%까지 반영`}
                </p>
              ) : (
                <p className="collection-impact__impact-note-line">
                  <b>{ranch || '목장'}</b> 월 톱밥 소요량이 설정되지 않았습니다. 축종·두수·계절에 따라 크게 달라서(예: 한우 100두 월 15~20톤) 실제 구입량을 넣어주세요.
                </p>
              )}
              <p className="collection-impact__impact-note-line">
                <b>단가</b> {priceLabel} · 목장별 단가를 넣지 않으면 기본 단가를 씁니다
              </p>
            </>
          }
        />

        <OdorImpactCard year={year} month={month} receivingRanch={receivingRanch} />
      </div>
    </section>
  );
}
