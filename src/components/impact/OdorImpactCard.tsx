import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useCompost } from '../../contexts/CompostContext';
import { ODOR_FIELD_RECORD, odorReductionPercent } from '../../constants/impactFactors';
import {
  ODOR_GAS_META,
  deleteOdorMeasurement,
  loadOdorMeasurements,
  newOdorId,
  odorReduction,
  readCachedOdor,
  saveOdorMeasurement,
  type OdorGas,
  type OdorMeasurement,
} from '../../services/odorService';
import { getCurrentDateString, normalizeName } from '../../utils/calculations';
import { TaskModal } from '../assistant/TaskModal';
import { ImpactCard, NoteLine } from './ImpactCard';

interface OdorImpactCardProps {
  year: number;
  month: number;
  /** 수거한 커피박을 받는 목장 — 같은 달 기록이 여러 목장이면 이 목장을 먼저 본다 */
  receivingRanch: string | null;
}

function reductionText(m: OdorMeasurement): string {
  const r = odorReduction(m);
  return r >= 0 ? `${r}% 저감` : `${Math.abs(r)}% 증가`;
}

function amountText(m: OdorMeasurement): string {
  const unit = ODOR_GAS_META[m.gas].unit;
  return `${m.before} → ${m.after}${unit === 'ppm' ? 'ppm' : `(${unit})`}`;
}

/**
 * 악취 저감 카드 — 선택한 달에 현장 측정 기록이 있으면 그 값을, 없으면 2025 시범사업 기록을 참고로 보여 준다.
 */
export function OdorImpactCard({ year, month, receivingRanch }: OdorImpactCardProps) {
  const { googleConfig } = useCompost();
  const webhookUrl = googleConfig.sheetWebhookUrl;
  const [items, setItems] = useState<OdorMeasurement[]>(readCachedOdor);
  const [notice, setNotice] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);

  const reload = useCallback(async () => {
    const result = await loadOdorMeasurements(webhookUrl);
    if (result.ok) {
      setItems(result.items);
      setNotice(null);
    } else {
      setItems(result.cached);
      setNotice(result.message);
    }
  }, [webhookUrl]);

  useEffect(() => {
    let alive = true;
    void loadOdorMeasurements(webhookUrl).then(result => {
      if (!alive) return;
      setItems(result.ok ? result.items : result.cached);
      setNotice(result.ok ? null : result.message);
    });
    return () => {
      alive = false;
    };
  }, [webhookUrl]);

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const inMonth = useMemo(
    () => items.filter(m => m.date.startsWith(monthKey)).sort((a, b) => b.date.localeCompare(a.date)),
    [items, monthKey]
  );
  const ranch = receivingRanch ? normalizeName(receivingRanch) : '';
  const pick = inMonth.find(m => normalizeName(m.ranchName) === ranch) ?? inMonth[0] ?? null;

  const ref = ODOR_FIELD_RECORD;
  const manageButton = (
    <button type="button" className="collection-impact__impact-button" onClick={() => setManaging(true)}>
      측정 기록 관리{items.length > 0 ? ` (${items.length})` : ''}
    </button>
  );

  const referenceNotes = (
    <>
      <NoteLine label="2025 참고 기록">
        {ref.site} · {ref.gas} {ref.before} → {ref.after}
        {ref.unit} · {ref.bedding} · 보고서 표기 {ref.reportedReductionPercent}% (계산 {odorReductionPercent()}%)
      </NoteLine>
      <NoteLine label="출처">{ref.source}</NoteLine>
      <ul>
        {ref.limits.map(line => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </>
  );

  return (
    <>
      {pick ? (
        <ImpactCard
          badge="현장 측정"
          title={`악취 저감 · ${ODOR_GAS_META[pick.gas].label}`}
          value={reductionText(pick)}
          sub={`${pick.ranchName} ${pick.date} · ${amountText(pick)}${inMonth.length > 1 ? ` · 이달 기록 ${inMonth.length}건` : ''}`}
          infoLabel="악취 측정 기록"
          info={
            <>
              <NoteLine label="산정식">(사용 전 − 사용 후) ÷ 사용 전 × 100</NoteLine>
              <NoteLine label="이달 기록">{`${inMonth.length}건`}</NoteLine>
              <ul>
                {inMonth.map(m => (
                  <li key={m.id}>
                    {m.date} {m.ranchName}
                    {m.location ? ` ${m.location}` : ''} · {ODOR_GAS_META[m.gas].label} {amountText(m)} · {reductionText(m)}
                    {m.bedding ? ` · ${m.bedding}` : ''}
                    {m.method ? ` · ${m.method}` : ''}
                  </li>
                ))}
              </ul>
              <NoteLine>앱에 직접 입력한 현장 측정 기록입니다. 공인 시험기관 성적서가 아니며, 측정 조건(시간대·환기·온습도)에 따라 값이 달라집니다.</NoteLine>
              {notice && <NoteLine label="알림">{notice}</NoteLine>}
              {referenceNotes}
            </>
          }
          action={manageButton}
        />
      ) : (
        <ImpactCard
          badge="참고 기록 · 2025"
          title={`악취 저감 · ${ref.gas}`}
          value={`${ref.reportedReductionPercent}% 저감`}
          sub={`${month}월 측정 기록 없음 · ${ref.site} ${ref.before} → ${ref.after}${ref.unit}`}
          infoLabel="악취 저감 기록"
          info={
            <>
              <NoteLine>
                선택한 달에 입력된 악취 측정 기록이 없어 2025년 시범사업 결과를 참고로 보여 드립니다. [측정 기록 관리]에서 측정값을 넣으면 그 달의 값으로 바뀝니다.
              </NoteLine>
              {notice && <NoteLine label="알림">{notice}</NoteLine>}
              <NoteLine label="기록">{ref.installed}</NoteLine>
              {referenceNotes}
            </>
          }
          action={manageButton}
        />
      )}

      {managing && (
        <OdorRecordsModal
          webhookUrl={webhookUrl}
          items={items}
          notice={notice}
          defaultRanch={ranch}
          onChanged={reload}
          onClose={() => setManaging(false)}
        />
      )}
    </>
  );
}

const inputClass =
  'w-full h-10 rounded-lg bg-[#F2F2F7] dark:bg-[#2C2C2E] px-2.5 text-sm text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/5 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#315C36]/40';
const labelClass = 'flex flex-col gap-1 text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93]';

function OdorRecordsModal({
  webhookUrl,
  items,
  notice,
  defaultRanch,
  onChanged,
  onClose,
}: {
  webhookUrl: string;
  items: OdorMeasurement[];
  notice: string | null;
  defaultRanch: string;
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const { ranchNames } = useCompost();
  const ranchOptions = ranchNames.length > 0 ? ranchNames : defaultRanch ? [defaultRanch] : [];
  const [form, setForm] = useState({
    date: getCurrentDateString(),
    ranchName: ranchOptions.includes(defaultRanch) ? defaultRanch : ranchOptions[0] ?? '',
    location: '',
    gas: 'NH3' as OdorGas,
    before: '',
    after: '',
    bedding: '커피박 50% + 톱밥 50%',
    method: '',
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const before = Number(form.before);
  const after = Number(form.after);
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(form.date) &&
    form.ranchName.trim() !== '' &&
    form.before !== '' &&
    form.after !== '' &&
    Number.isFinite(before) &&
    before > 0 &&
    Number.isFinite(after) &&
    after >= 0;
  const preview = valid ? odorReduction({ before, after }) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const result = await saveOdorMeasurement(webhookUrl, {
      id: newOdorId(),
      date: form.date,
      ranchName: form.ranchName.trim(),
      location: form.location.trim(),
      gas: form.gas,
      before,
      after,
      bedding: form.bedding.trim(),
      method: form.method.trim(),
      notes: form.notes.trim(),
    });
    setBusy(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) {
      setForm(prev => ({ ...prev, before: '', after: '', notes: '' }));
      await onChanged();
    }
  };

  const remove = async (m: OdorMeasurement) => {
    if (!window.confirm(`${m.date} ${m.ranchName} ${ODOR_GAS_META[m.gas].label} 기록을 지울까요?\n시트에서도 지워집니다.`)) return;
    setBusy(true);
    const result = await deleteOdorMeasurement(webhookUrl, m.id);
    setBusy(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) await onChanged();
  };

  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  const unit = ODOR_GAS_META[form.gas].unit;

  return (
    <TaskModal title="악취 측정 기록" subtitle="커피박 깔짚 사용 전·후 측정값 · 부숙관리 시트 '악취측정' 탭" maxWidth="xl" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2.5">
          <label className={labelClass}>
            측정일
            <input type="date" required value={form.date} onChange={set('date')} className={inputClass} />
          </label>
          <label className={labelClass}>
            목장
            <select required value={form.ranchName} onChange={set('ranchName')} className={inputClass}>
              {ranchOptions.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            측정 항목
            <select value={form.gas} onChange={set('gas')} className={inputClass}>
              {(Object.keys(ODOR_GAS_META) as OdorGas[]).map(key => (
                <option key={key} value={key}>
                  {ODOR_GAS_META[key].label} · {ODOR_GAS_META[key].unit}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            측정 장소 (선택)
            <input value={form.location} onChange={set('location')} maxLength={100} placeholder="예: 실내축사 2동" className={inputClass} />
          </label>
          <label className={labelClass}>
            사용 전 ({unit})
            <input type="number" inputMode="decimal" min={0} step="any" required value={form.before} onChange={set('before')} className={inputClass} />
          </label>
          <label className={labelClass}>
            사용 후 ({unit})
            <input type="number" inputMode="decimal" min={0} step="any" required value={form.after} onChange={set('after')} className={inputClass} />
          </label>
          <label className={`${labelClass} col-span-2`}>
            깔짚 조건
            <input value={form.bedding} onChange={set('bedding')} maxLength={100} className={inputClass} />
          </label>
          <label className={`${labelClass} col-span-2`}>
            측정 방법·장비 (선택)
            <input value={form.method} onChange={set('method')} maxLength={100} placeholder="예: ICT 악취측정기 7일 평균" className={inputClass} />
          </label>
          <label className={`${labelClass} col-span-2`}>
            비고 (선택)
            <input value={form.notes} onChange={set('notes')} maxLength={200} className={inputClass} />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">
            {preview === null ? '사용 전·후 값을 넣으면 저감률을 계산합니다' : `저감률 ${preview >= 0 ? `${preview}%` : `${Math.abs(preview)}% 증가`}`}
          </span>
          <button
            type="submit"
            disabled={!valid || busy}
            className="h-10 px-4 rounded-xl bg-[#315C36] text-white text-sm font-bold disabled:opacity-40"
          >
            {busy ? '저장 중…' : '기록 저장'}
          </button>
        </div>
        {(message || notice) && (
          <p
            role="status"
            className={`text-xs ${message?.ok ? 'text-[#315C36] dark:text-[#34C759]' : 'text-[#C5221F] dark:text-[#FF6961]'}`}
          >
            {message?.text ?? notice}
          </p>
        )}
      </form>

      <h4 className="mt-5 mb-2 text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">저장된 기록 {sorted.length}건</h4>
      {sorted.length === 0 ? (
        <p className="text-xs text-[#6E6E73] dark:text-[#8E8E93]">아직 입력된 측정 기록이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {sorted.map(m => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-[#F2F2F7] dark:bg-[#2C2C2E] px-3 py-2"
            >
              <div className="min-w-0 text-xs text-[#1D1D1F] dark:text-[#F5F5F7]">
                <b>{m.date}</b> {m.ranchName}
                {m.location ? ` · ${m.location}` : ''}
                <span className="block text-[#6E6E73] dark:text-[#8E8E93]">
                  {ODOR_GAS_META[m.gas].label} {amountText(m)} · {reductionText(m)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void remove(m)}
                disabled={busy}
                aria-label={`${m.date} ${m.ranchName} 기록 삭제`}
                className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[#C5221F] hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </TaskModal>
  );
}
