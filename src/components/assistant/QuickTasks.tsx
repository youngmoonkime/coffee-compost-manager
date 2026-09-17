import React, { useId, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { CompostSettings } from '../../types';
import type { CycleStatus } from '../../utils/fieldOps';
import {
  buildFieldCheck,
  diagnoseFarm,
  FARM_QUESTIONS,
  farmExplainFacts,
  fieldExplainFacts,
  latestRecordKey,
  type BeddingDecisionKey,
  type FarmAnswers,
  type SignalLevel,
} from '../../utils/assistantInsights';
import { requestExplanation, type Explanation, type ExplainKind } from '../../services/aiExplain';
import type { SourceKind } from '../ui/SourceBadge';
import { InfoButton, InfoHeading, InfoNote } from './InfoTip';

/*
 * 빠른 실행 팝업의 본문.
 * 출처(실측·계산)와 상태(주의·경고)는 태그로 늘어놓지 않고,
 * 값의 색과 점으로만 보여 준 뒤 ⓘ 를 누르면 자세히 펼친다.
 */

/* ───────────────────────── 공통 조각 ───────────────────────── */

const SOURCE_TEXT: Record<SourceKind, string> = {
  measured: '현장 실측',
  computed: '앱 계산',
  observed: '현장 관찰 기준',
  ai: 'AI 문장',
};

const LEVEL_TEXT: Record<SignalLevel, string> = {
  alert: '경고',
  caution: '주의',
  unknown: '기록 없음',
  ok: '정상',
};

const LEVEL_VALUE_CLASS: Record<SignalLevel, string> = {
  alert: 'text-[#C5221F] dark:text-[#FF6961]',
  caution: 'text-[#B06000] dark:text-[#FF9F0A]',
  unknown: 'text-[#8E8E93]',
  ok: 'text-[#1D1D1F] dark:text-[#F5F5F7]',
};

const LEVEL_DOT_CLASS: Partial<Record<SignalLevel, string>> = {
  alert: 'bg-[#FF3B30]',
  caution: 'bg-[#FF9F0A]',
};

const DECISION_STYLE: Record<BeddingDecisionKey, string> = {
  accumulating: 'bg-black/5 dark:bg-white/10 text-[#1D1D1F] dark:text-[#F5F5F7]',
  managing: 'bg-[#007AFF]/10 text-[#0062CC] dark:text-[#0A84FF]',
  preparing: 'bg-[#315C36]/15 text-[#315C36] dark:text-[#34C759]',
  candidate: 'bg-[#315C36] text-white dark:bg-[#34C759] dark:text-[#04260C]',
  hold: 'bg-[#FF3B30]/15 text-[#C5221F] dark:text-[#FF6961]',
  insufficient: 'bg-[#FF9F0A]/15 text-[#B06000] dark:text-[#FF9F0A]',
};

/** 한 줄 항목: 이름 · 값(상태 색) · ⓘ */
interface RowProps {
  label: string;
  value: string;
  sources: SourceKind[];
  level?: SignalLevel;
  advice?: string;
}

const CheckRow: React.FC<RowProps> = ({ label, value, sources, level, advice }) => {
  const [open, setOpen] = useState(false);
  const noteId = useId();
  const flagged = level === 'alert' || level === 'caution';

  return (
    <li className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] shrink-0">{label}</span>
        <div className="flex items-start gap-1.5 min-w-0">
          {level && LEVEL_DOT_CLASS[level] && (
            <span className={`mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 ${LEVEL_DOT_CLASS[level]}`} aria-hidden="true" />
          )}
          <span className={`text-[13.5px] font-semibold text-right break-keep ${LEVEL_VALUE_CLASS[level ?? 'ok']}`}>
            {value}
          </span>
          <InfoButton open={open} onToggle={() => setOpen(v => !v)} controls={noteId} label={label} />
        </div>
      </div>
      {flagged && advice && (
        <p className="mt-1 text-[12px] leading-relaxed text-[#6E6E73] dark:text-[#8E8E93] break-keep">{advice}</p>
      )}
      {open && (
        <InfoNote id={noteId}>
          출처: {sources.map(s => SOURCE_TEXT[s]).join(' · ')}
          {level && <> · 상태: {LEVEL_TEXT[level]}</>}
        </InfoNote>
      )}
    </li>
  );
};

const SectionInfo: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <InfoHeading
    title={<h4 className="text-xs font-bold text-[#6E6E73] dark:text-[#8E8E93]">{title}</h4>}
    label={title}
    note={children}
  />
);

/* ───────────────────────── AI 설명 (버튼을 눌렀을 때만) ───────────────────────── */

interface AiExplainBoxProps {
  webhookUrl: string;
  kind: ExplainKind;
  slot: string;
  dataKey: string;
  facts: Record<string, unknown>;
  label?: string;
}

export const AiExplainBox: React.FC<AiExplainBoxProps> = ({
  webhookUrl,
  kind,
  slot,
  dataKey,
  facts,
  label = 'AI 설명 보기',
}) => {
  const [busy, setBusy] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (refresh: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const result = await requestExplanation({ webhookUrl, kind, slot, dataKey, facts, refresh });
      if (result.success && result.explanation) {
        setExplanation(result.explanation);
        setFromCache(Boolean(result.fromCache));
      } else {
        setError(result.message ?? 'AI 요청이 실패했습니다.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-4 border-t border-black/5 dark:border-white/10 space-y-2.5">
      {!explanation && (
        <button
          type="button"
          onClick={() => void run(false)}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#AF52DE]/30 bg-[#AF52DE]/5 text-[#8944AB] dark:text-[#BF5AF2] text-[13px] font-bold hover:bg-[#AF52DE]/10 active:scale-[0.99] transition-all disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>{busy ? 'AI 설명을 만드는 중' : `${label} ✦`}</span>
        </button>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 p-3 rounded-xl bg-[#FF9F0A]/10 text-xs text-[#1D1D1F] dark:text-[#F5F5F7]"
        >
          <AlertCircle className="w-4 h-4 text-[#D97706] dark:text-[#FF9F0A] shrink-0 mt-0.5" />
          <div>
            <strong className="block">AI 설명을 불러오지 못했습니다.</strong>
            <span className="text-[#6E6E73] dark:text-[#8E8E93]">{error}</span>
          </div>
        </div>
      )}

      {explanation && (
        <div className="p-3.5 rounded-xl bg-[#AF52DE]/5 border border-[#AF52DE]/20 space-y-2">
          <InfoHeading
            title={
              <span className="flex items-center gap-1.5 text-[12px] font-bold text-[#8944AB] dark:text-[#BF5AF2]">
                <Sparkles className="w-3.5 h-3.5" />
                AI 설명
                <span className="font-normal text-[#8E8E93]">· {fromCache ? '저장된 설명' : '방금 작성'}</span>
              </span>
            }
            label="AI 설명"
            note="판정과 숫자는 현장 기록으로 계산한 값이고, 이 문장은 AI 가 그 결과를 풀어 쓴 것입니다. 같은 기록이면 저장해 둔 설명을 다시 보여 드립니다."
          />
          <p className="text-[13.5px] leading-relaxed text-[#1D1D1F] dark:text-[#F5F5F7] break-keep">
            {explanation.summary}
          </p>
          {explanation.actions.length > 0 && (
            <ul className="space-y-1">
              {explanation.actions.map(action => (
                <li key={action} className="flex items-start gap-1.5 text-[13px] text-[#1D1D1F] dark:text-[#E5E5EA]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#8944AB] dark:text-[#BF5AF2] shrink-0 mt-0.5" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => void run(true)}
              disabled={busy}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8944AB] dark:text-[#BF5AF2] disabled:opacity-60"
            >
              <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
              <span>새로 쓰기 ✦</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ───────────────────────── 깔개 사용 · 이상 신호 점검 ───────────────────────── */

export const FieldCheckPanel: React.FC<{
  status: CycleStatus;
  settings: CompostSettings;
  today: string;
  webhookUrl: string;
}> = ({ status, settings, today, webhookUrl }) => {
  const check = useMemo(() => buildFieldCheck(status, settings, today), [status, settings, today]);
  const facts = useMemo(() => fieldExplainFacts(status, check), [status, check]);
  const { decision, signals, rows } = check;
  const summaryLevel: SignalLevel =
    signals.alertCount > 0 ? 'alert' : signals.cautionCount > 0 ? 'caution' : 'ok';

  return (
    <div className="space-y-4">
      {/* 판정 한 줄 */}
      <div className="flex items-center justify-between gap-3">
        <span className={`px-3 py-1 rounded-full text-[13px] font-bold ${DECISION_STYLE[decision.key]}`}>
          {decision.label}
        </span>
        <span
          className={`text-[12px] font-semibold ${
            summaryLevel === 'ok' ? 'text-[#315C36] dark:text-[#34C759]' : LEVEL_VALUE_CLASS[summaryLevel]
          }`}
        >
          {signals.summary}
        </span>
      </div>

      <p className="text-[14px] leading-relaxed text-[#1D1D1F] dark:text-[#F5F5F7] break-keep">{decision.reason}</p>

      <div className="p-3 rounded-xl bg-[#315C36]/5 dark:bg-[#34C759]/10">
        <h4 className="text-[11px] font-bold text-[#315C36] dark:text-[#34C759] mb-0.5">다음 행동</h4>
        <p className="text-[13.5px] text-[#1D1D1F] dark:text-[#F5F5F7] break-keep">{decision.nextAction}</p>
      </div>

      <div>
        <SectionInfo title="판정 근거">
          저장된 현장 기록으로 계산한 판정입니다. 색 점은 주의(주황)·경고(빨강) 항목이고, 각 줄의 ⓘ 에서
          출처를 볼 수 있습니다. 아래 ✦ 버튼을 누르면 AI 가 이 결과를 문장으로 풀어 드립니다.
        </SectionInfo>
        <ul className="mt-1 divide-y divide-black/5 dark:divide-white/10">
          {rows.map(row => (
            <CheckRow key={row.label} {...row} />
          ))}
        </ul>
      </div>

      {decision.missing.length > 0 && (
        <p className="text-[12px] text-[#B06000] dark:text-[#FF9F0A] break-keep">
          빠진 자료: {decision.missing.join(' ')}
        </p>
      )}

      <AiExplainBox
        key={latestRecordKey(status)}
        webhookUrl={webhookUrl}
        kind="field"
        slot={`field:${status.ranchName}`}
        dataKey={latestRecordKey(status)}
        facts={facts}
      />
    </div>
  );
};

/* ───────────────────────── 신규 목장 적용 검토 ───────────────────────── */

export const NewFarmPanel: React.FC<{ webhookUrl: string }> = ({ webhookUrl }) => {
  const [answers, setAnswers] = useState<Partial<FarmAnswers>>({});
  const answeredAll = FARM_QUESTIONS.every(q => answers[q.key] !== undefined);
  const complete = answeredAll ? (answers as FarmAnswers) : null;
  const diagnosis = useMemo(() => (complete ? diagnoseFarm(complete) : null), [complete]);
  const facts = useMemo(
    () => (complete && diagnosis ? farmExplainFacts(complete, diagnosis) : null),
    [complete, diagnosis]
  );

  return (
    <div className="space-y-4">
      <ol className="space-y-3.5">
        {FARM_QUESTIONS.map((q, index) => (
          <li key={q.key}>
            <p className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5">
              {index + 1}. {q.question}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {q.options.map(option => {
                const selected = answers[q.key] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setAnswers(prev => ({ ...prev, [q.key]: option.value }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                      selected
                        ? 'bg-[#315C36] text-white'
                        : 'bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      {!diagnosis && (
        <p className="text-[12px] text-[#8E8E93]">
          {FARM_QUESTIONS.length - Object.keys(answers).length}개 항목에 답하면 진단 결과가 나옵니다.
        </p>
      )}

      {diagnosis && complete && facts && (
        <div className="space-y-4 pt-4 border-t border-black/5 dark:border-white/10">
          <div>
            <SectionInfo title="진단 결과">
              답한 체크리스트로 바로 정한 결과입니다. 권장 관리 주기는 건준목장 현장 관찰 기준이고, 아래 ✦ 버튼을
              누르면 AI 가 운영안을 문장으로 정리해 드립니다.
            </SectionInfo>
            <ul className="mt-1 divide-y divide-black/5 dark:divide-white/10">
              <CheckRow label="운영 유형" value={diagnosis.operationType} sources={['computed']} />
              <CheckRow label="관리 수준" value={diagnosis.managementLevel} sources={['computed']} />
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[#6E6E73] dark:text-[#8E8E93] mb-1">권장 관리</h4>
            <ul className="space-y-0.5 text-[13.5px] text-[#1D1D1F] dark:text-[#F5F5F7]">
              {diagnosis.recommendations.map(item => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[#6E6E73] dark:text-[#8E8E93] mb-1">필요한 측정 항목</h4>
            <p className="text-[13.5px] text-[#1D1D1F] dark:text-[#F5F5F7] break-keep">
              {diagnosis.measurements.join(' · ')}
            </p>
          </div>

          {diagnosis.gaps.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[#B06000] dark:text-[#FF9F0A] mb-1">부족한 관리 조건</h4>
              <ul className="space-y-0.5 text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7]">
                {diagnosis.gaps.map(gap => (
                  <li key={gap}>· {gap}</li>
                ))}
              </ul>
            </div>
          )}

          <AiExplainBox
            key={JSON.stringify(complete)}
            webhookUrl={webhookUrl}
            kind="farm"
            slot="farm"
            dataKey="checklist"
            facts={facts}
            label="AI로 운영안 설명 만들기"
          />
        </div>
      )}
    </div>
  );
};
