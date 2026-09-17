import { useState } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { CARBON_FACTOR_NOTE, COFFEE_GROUNDS_INCINERATION_CO2_PER_KG } from '../../constants/impactFactors';
import { computeSawdustSaving } from '../../utils/sawdustSaving';
import { ImpactCard } from './ImpactCard';
import { OdorImpactCard } from './OdorImpactCard';
import { TaskModal } from '../assistant/TaskModal';

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
  const [editingSawdust, setEditingSawdust] = useState(false);
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
            !ranch
              ? '수거관리 시트에 이 달의 운영 목장 정보가 없어 계산하지 않습니다'
              : saw.savingKrw === null || saw.savedTons === null || saw.monthlyTons === null
                ? `${ranch}의 월 톱밥 소요량을 넣으면 계산합니다`
                : `${ranch} · 줄어든 톱밥 ${fmtTons(saw.savedTons)}톤 × ${priceLabel}`
          }
          action={
            ranch ? (
              <button type="button" className="collection-impact__impact-button" onClick={() => setEditingSawdust(true)}>
                {ranch} 톱밥 설정
              </button>
            ) : undefined
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

      {editingSawdust && ranch && <SawdustSettingModal ranch={ranch} onClose={() => setEditingSawdust(false)} />}
    </section>
  );
}

const fieldClass =
  'w-full h-10 rounded-lg bg-[#F2F2F7] dark:bg-[#2C2C2E] px-2.5 text-sm text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/5 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#315C36]/40';

/**
 * 수거관리의 운영 목장(예: 다원목장)은 부숙 기록이 없어 설정 목록에 없을 수 있다.
 * 이 창에서 그 목장의 톱밥 단가·월 소요량을 바로 넣는다 — 넣고 나면 설정 > 목장 설정에도 탭이 생긴다.
 */
function SawdustSettingModal({ ranch, onClose }: { ranch: string; onClose: () => void }) {
  const { settings, updateSettings } = useCompost();
  const [price, setPrice] = useState(String(settings.sawdustPriceByRanch?.[ranch] ?? ''));
  const [monthly, setMonthly] = useState(String(settings.sawdustMonthlyTonsByRanch?.[ranch] ?? ''));

  const priceNum = Number(price);
  const monthlyNum = Number(monthly);
  const priceOk = price.trim() === '' || (Number.isFinite(priceNum) && priceNum > 0);
  const monthlyOk = monthly.trim() === '' || (Number.isFinite(monthlyNum) && monthlyNum > 0);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceOk || !monthlyOk) return;
    const prices = { ...settings.sawdustPriceByRanch };
    const demands = { ...settings.sawdustMonthlyTonsByRanch };
    if (price.trim() === '') delete prices[ranch];
    else prices[ranch] = Math.round(priceNum);
    if (monthly.trim() === '') delete demands[ranch];
    else demands[ranch] = Math.round(monthlyNum * 10) / 10;
    updateSettings({ sawdustPriceByRanch: prices, sawdustMonthlyTonsByRanch: demands });
    onClose();
  };

  return (
    <TaskModal title={`${ranch} 톱밥 설정`} subtitle="톱밥 구매비 절감 계산에 씁니다 · 설정 > 목장 설정과 같은 값" onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93]">
          월 톱밥 소요량 (톤/월)
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            placeholder="예: 18"
            value={monthly}
            onChange={e => setMonthly(e.target.value)}
            className={fieldClass}
          />
          <span className="font-normal">한 달에 실제로 사는 톱밥 양입니다. 축종·두수·계절에 따라 크게 달라집니다 (예: 한우 100두 월 15~20톤).</span>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93]">
          톱밥 구매 단가 (원/톤)
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            placeholder={`비우면 기본 단가 ${settings.sawdustPricePerTon.toLocaleString('ko-KR')}원`}
            value={price}
            onChange={e => setPrice(e.target.value)}
            className={fieldClass}
          />
        </label>
        {(!priceOk || !monthlyOk) && (
          <p role="alert" className="text-xs text-[#C5221F] dark:text-[#FF6961]">0보다 큰 숫자를 넣거나 비워 두세요.</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-semibold text-[#6E6E73] dark:text-[#8E8E93]">
            취소
          </button>
          <button
            type="submit"
            disabled={!priceOk || !monthlyOk}
            className="h-10 px-4 rounded-xl bg-[#315C36] text-white text-sm font-bold disabled:opacity-40"
          >
            저장
          </button>
        </div>
      </form>
    </TaskModal>
  );
}
