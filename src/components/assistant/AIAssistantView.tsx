import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, Bot, ChevronRight, FileText, Loader2, Sparkles, Sprout, Trash2, Wheat } from 'lucide-react';
import { useCompost } from '../../contexts/CompostContext';
import { DEFAULT_RANCH_NAME } from '../../constants/defaultData';
import { gasApi, getCollectionSheetUrl, type CollectionData, type DashboardData } from '../../services/gasClient';
import {
  buildImpactFacts,
  getCurrentPeriod,
  hasEnoughData,
  periodOptions,
  type ImpactFacts,
} from '../../services/reportData';
import { AUDIENCE_LABELS, requestStandardImpactReport, type ReportAudience } from '../../services/aiReport';
import { hashText } from '../../services/aiExplain';
import { getCurrentDateString, normalizeName } from '../../utils/calculations';
import { summarizeCycle } from '../../utils/fieldOps';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { ImpactReportView, type SavedReport } from './ImpactReportView';
import { CollectionImpactDashboard } from '../impact/CollectionImpactDashboard';
import { FieldCheckPanel, NewFarmPanel } from './QuickTasks';
import { TaskModal } from './TaskModal';
import { InfoHeading } from './InfoTip';
import '../../styles/ai-assistant.css';

/** 보관함에 남기는 리포트 수 */
const HISTORY_LIMIT = 5;

type QuickTask = 'field' | 'farm';

/** 빠른 실행 카드 — 기본 결과는 모두 코드로 만든다 */
const QUICK_TASKS: { id: QuickTask; icon: React.ElementType; title: string; desc: string }[] = [
  {
    id: 'field',
    icon: Wheat,
    title: '깔개 사용 · 이상 신호 점검',
    desc: '깔개로 써도 되는지와 곰팡이·혼합 부족·급상승을 함께 봅니다',
  },
  { id: 'farm', icon: Sprout, title: '신규 목장 적용 검토', desc: '체크리스트로 운영 유형과 관리 수준 진단' },
];

/** 리포트 구성(프롬프트·독자별 자료)을 바꾸면 올린다 — 예전 저장본을 같은 자료로 보고 다시 열지 않도록 */
const REPORT_FORMAT_VERSION = 2;

/** 만든 시각을 뺀 리포트 자료의 지문 — 같으면 AI 를 다시 부르지 않는다 */
function factsFingerprint(facts: ImpactFacts, audience: ReportAudience): string {
  return `v${REPORT_FORMAT_VERSION}:${hashText(JSON.stringify({ ...facts, generatedAt: '' }))}:${audience}`;
}

export const AIAssistantView: React.FC = () => {
  const {
    records,
    settings,
    googleConfig,
    getCycle,
    activePile,
    setActivePile,
    measuredRanchNames,
    isLoadingFromSheet,
    lastSheetLoadAt,
  } = useCompost();
  const webhookUrl = googleConfig.sheetWebhookUrl;
  const today = getCurrentDateString();

  const now = getCurrentPeriod();
  const periods = useMemo(() => periodOptions(records), [records]);
  const [periodKey, setPeriodKey] = useState(`${now.year}-${now.month}`);
  const period = periods.find(p => `${p.year}-${p.month}` === periodKey) ?? periods.find(p => `${p.year}-${p.month}` === `${now.year}-${now.month}`) ?? periods[0];
  const [audience, setAudience] = useState<ReportAudience>('farm');

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [collections, setCollections] = useState<CollectionData | null>(null);
  /** 수거 시트를 어느 기간까지 확인했는지 — 지금 기간과 같으면 확인이 끝난 것 */
  const [loadedPeriodKey, setLoadedPeriodKey] = useState<string | null>(null);
  const collectionReady = loadedPeriodKey === periodKey;

  const [report, setReport] = useState<SavedReport | null>(null);
  const [reportReused, setReportReused] = useState(false);
  const [history, setHistory] = useState<SavedReport[]>(() => getStorageItem<SavedReport[]>('ai_reports', []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<QuickTask | null>(null);
  const closeTask = useCallback(() => setActiveTask(null), []);
  const [showDashboardModal, setShowDashboardModal] = useState(false);

  // 수거 시트는 있으면 쓰고, 없으면 부숙 기록만으로 리포트를 만든다 (AI 호출 아님)
  useEffect(() => {
    let alive = true;
    const key = `${period.year}-${period.month}`;
    void Promise.allSettled([
      gasApi.dashboard(period.year, period.month),
      gasApi.collections(period.year, period.month),
    ]).then(([dash, coll]) => {
      if (!alive) return;
      setDashboard(dash.status === 'fulfilled' ? dash.value : null);
      setCollections(coll.status === 'fulfilled' ? coll.value : null);
      setLoadedPeriodKey(key);
    });
    return () => {
      alive = false;
    };
  }, [period.year, period.month]);

  // 분석은 투입 기록이 있는 목장만 — 없으면 기본 목장
  const ranchNames = measuredRanchNames.length > 0 ? measuredRanchNames : [DEFAULT_RANCH_NAME];
  const ranchName = ranchNames.includes(normalizeName(activePile.ranchName))
    ? normalizeName(activePile.ranchName)
    : ranchNames[0];

  const status = useMemo(
    () => summarizeCycle({ records, ranchName, settings, cycle: getCycle(ranchName), today }),
    [records, ranchName, settings, getCycle, today]
  );

  // 리포트에 들어갈 숫자 — 기록 수가 많지 않아 그릴 때마다 셈해도 부담이 없다
  const facts = buildImpactFacts({
    records,
    settings,
    period,
    dashboard,
    collections,
    compostConnected: Boolean(webhookUrl),
    getCycle,
  });

  const saveToHistory = useCallback((next: SavedReport) => {
    setHistory(prev => {
      const list = [next, ...prev.filter(item => item.id !== next.id)].slice(0, HISTORY_LIMIT);
      setStorageItem('ai_reports', list);
      return list;
    });
  }, []);

  const deleteFromHistory = (target: SavedReport) => {
    if (!window.confirm(`'${target.sections.headline}' 리포트를 삭제할까요?
이 기기에서 지워지며 되돌릴 수 없습니다.`)) return;
    setHistory(prev => {
      const list = prev.filter(item => !(item.id === target.id && item.createdAt === target.createdAt));
      setStorageItem('ai_reports', list);
      return list;
    });
  };

  const runReport = useCallback(
    async (force: boolean) => {
      setError(null);
      if (!hasEnoughData(facts)) {
        setError('아직 리포트를 만들 자료가 없습니다. 측정 기록을 먼저 저장해주세요.');
        return;
      }

      const id = `${period.year}-${period.month}-${audience}`;
      const fingerprint = factsFingerprint(facts, audience);

      // 같은 자료·같은 독자로 만든 리포트가 있으면 AI 를 부르지 않고 연다
      if (!force) {
        const saved = history.find(item => item.id === id && item.factsKey === fingerprint);
        if (saved) {
          setReport(saved);
          setReportReused(true);
          return;
        }
      }

      setBusy(true);
      try {
        const standardFacts = facts.standardReport!;
        const result = await requestStandardImpactReport(webhookUrl, standardFacts);
        if (!result.sections) {
          setError(result.message ?? '리포트를 생성하지 못했습니다.');
          return;
        }

        const next: SavedReport = {
          id,
          createdAt: new Date().toISOString(),
          audience,
          model: result.model ?? '코드 계산 & Gemini AI',
          facts,
          factsKey: fingerprint,
          sections: {
            headline: standardFacts.title,
            summary: result.sections.executiveSummary,
            meaning: result.sections.trendCommentary,
            recommendation: result.sections.issues[0]?.action ?? '',
            actions: result.sections.nextActions,
          },
          standardSections: result.sections,
        };
        setReport(next);
        setReportReused(false);
        saveToHistory(next);
      } finally {
        setBusy(false);
      }
    },
    [facts, webhookUrl, audience, period, history, saveToHistory]
  );

  if (report) {
    return (
      <div className="ai-assistant-view">
        <ImpactReportView
          report={report}
          reused={reportReused}
          onBack={() => {
            setReport(null);
            setError(null);
          }}
          onRegenerate={() => void runReport(true)}
          regenerating={busy}
          regenerateError={error}
        />
      </div>
    );
  }

  const basisParts = [
    `기록 ${records.length}건`,
    ranchName,
    collectionReady ? (dashboard ? '수거관리 연동' : '수거관리 미연동') : '수거관리 확인 중',
    isLoadingFromSheet ? '부숙관리 확인 중' : lastSheetLoadAt ? '부숙관리 최신' : '이 기기 기록',
  ];

  return (
    <div className="ai-assistant-view">
      <header className="ai-assistant-header">
        <div className="ai-assistant-header__brand">
          <div className="ai-assistant-header__icon" aria-hidden="true">
            <Bot className="w-6 h-6" />
          </div>
          <InfoHeading
            title={<h2 className="ai-assistant-header__title">지소행 AI 현장 어시스턴트</h2>}
            label="AI 현장 어시스턴트"
            note="판정과 숫자는 저장된 현장 기록으로 계산합니다. ✦ 표시가 있는 버튼을 누르면 AI 가 그 결과를 설명 문장으로 만들어 드립니다. AI 설명은 하루 사용 횟수가 정해져 있습니다."
          />
        </div>
      </header>

      {/* 데이터 상태 — 무엇을 근거로 보여 주는지 */}
      <div className="flex flex-col gap-2">
        <p className="ai-basis-bar">{basisParts.join(' · ')}</p>
        {ranchNames.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {ranchNames.map(name => (
              <button
                key={name}
                type="button"
                onClick={() => setActivePile({ ranchName: name, location: activePile.location })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                  name === ranchName
                    ? 'bg-[#315C36] text-white'
                    : 'bg-white dark:bg-[#1C1C1E] text-[#6E6E73] dark:text-[#8E8E93] border border-black/5 dark:border-white/10'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 빠른 실행 — 기본 결과는 AI 없이 코드로, 누르면 팝업으로 연다 */}
      <section className="ai-quick" aria-label="빠른 실행">
        <InfoHeading
          title={<h3>빠른 실행</h3>}
          label="빠른 실행"
          note="현장 기록으로 결과를 바로 계산해 팝업으로 보여 드립니다. 설명 문장이 필요하면 팝업 안의 ✦ 버튼을 누르세요."
        />
        <div className="ai-quick__grid">
          {QUICK_TASKS.map(task => (
            <button
              key={task.id}
              type="button"
              className="ai-quick__card"
              aria-haspopup="dialog"
              onClick={() => setActiveTask(task.id)}
            >
              <span className="ai-quick__card-icon" aria-hidden="true">
                <task.icon className="w-4 h-4" />
              </span>
              <span className="ai-quick__card-body">
                <strong>{task.title}</strong>
                <span>{task.desc}</span>
              </span>
              <ChevronRight className="ai-quick__card-chevron w-4 h-4" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      {activeTask === 'field' && (
        <TaskModal title="깔개 사용 · 이상 신호 점검" subtitle={`${ranchName} · 저장된 기록 기준`} onClose={closeTask}>
          <FieldCheckPanel status={status} settings={settings} today={today} webhookUrl={webhookUrl} />
        </TaskModal>
      )}
      {activeTask === 'farm' && (
        <TaskModal title="신규 목장 적용 검토" subtitle="체크리스트에 답하면 바로 진단합니다" onClose={closeTask}>
          <NewFarmPanel webhookUrl={webhookUrl} />
        </TaskModal>
      )}
      {showDashboardModal && (
        <TaskModal
          title={`${period.label} 수거 & 임팩트 대시보드`}
          subtitle="Google Sheets 수거관리 시트 실측 데이터"
          onClose={() => setShowDashboardModal(false)}
        >
          <div className="max-h-[75vh] overflow-y-auto px-1">
            <CollectionImpactDashboard year={period.year} month={period.month} embedded />
          </div>
        </TaskModal>
      )}

      {/* 자원순환 임팩트 리포트 — AI 가 문장을 쓴다 */}
      <section className="ai-request-card" aria-label="자원순환 임팩트 리포트 요청">
        <div className="ai-request-card__head">
          <div className="ai-request-card__icon" aria-hidden="true">
            <BarChart3 className="w-5 h-5" />
          </div>
          <InfoHeading
            title={<h3>자원순환 임팩트 리포트</h3>}
            label="자원순환 임팩트 리포트"
            description={<p>수거량과 부숙 현황을 한 장의 리포트로 정리합니다.</p>}
            note="수거량·절감액·부숙 현황 숫자는 기록에서 직접 계산하고, AI 가 요약과 다음 할 일을 문장으로 씁니다. 같은 기간·같은 자료로 만든 리포트는 새로 만들지 않고 저장본을 엽니다."
          />
        </div>

        <div className="ai-request-card__fields">
          <label>
            <span>기간</span>
            <select
              value={periodKey}
              onChange={event => {
                const nextKey = event.target.value;
                setPeriodKey(nextKey);
                setDashboard(null);
                setCollections(null);
                setLoadedPeriodKey(null);
                setError(null);
              }}
            >
              {[...new Set(periods.map(p => p.year))].map(year => (
                <optgroup key={year} label={`${year}년`}>
                  {periods
                    .filter(p => p.year === year)
                    .map(item => (
                      <option key={`${item.year}-${item.month}`} value={`${item.year}-${item.month}`}>
                        {item.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            <span>누가 읽나요</span>
            <select value={audience} onChange={event => setAudience(event.target.value as ReportAudience)}>
              {(Object.keys(AUDIENCE_LABELS) as ReportAudience[]).map(key => (
                <option key={key} value={key}>
                  {AUDIENCE_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* 선택한 기간의 수거 데이터 실시간 현황 카드 */}
        <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${collectionReady && dashboard ? 'bg-[#315C36] dark:bg-[#34C759]' : 'bg-[#8E8E93]'}`} />
              {period.label} 커피박 수거 현황
            </span>
            <div className="flex items-center gap-2">
              <a
                href={getCollectionSheetUrl(period.year, period.month)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-[#315C36] dark:text-[#34C759] hover:underline"
              >
                🔗 시트 원본 ↗
              </a>
              <span className="text-[11px] text-[#8E8E93]">
                {!collectionReady ? '조회 중...' : dashboard ? '수거 시트 연동' : '데이터 없음'}
              </span>
            </div>
          </div>

          {!collectionReady ? (
            <div className="flex items-center gap-2 py-2 text-xs text-[#8E8E93]">
              <Loader2 className="w-4 h-4 animate-spin text-[#315C36] dark:text-[#34C759]" />
              <span>{period.label} 수거 데이터를 구글 시트에서 가져오는 중입니다...</span>
            </div>
          ) : dashboard ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              <div className="bg-white dark:bg-[#1C1C1E] p-2.5 rounded-xl border border-black/5 dark:border-white/10">
                <span className="text-[10.5px] text-[#8E8E93] block font-medium">커피박 수거량</span>
                <strong className="text-[15px] font-bold text-[#315C36] dark:text-[#34C759] block mt-0.5">
                  {(dashboard.collection.totalKg / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })} t
                </strong>
                <span className="text-[10px] text-[#8E8E93] block">
                  {Math.round(dashboard.collection.totalKg).toLocaleString('ko-KR')} kg
                </span>
              </div>
              <div className="bg-white dark:bg-[#1C1C1E] p-2.5 rounded-xl border border-black/5 dark:border-white/10">
                <span className="text-[10.5px] text-[#8E8E93] block font-medium">수거 매장 수</span>
                <strong className="text-[15px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7] block mt-0.5">
                  {dashboard.collection.activeStoreCount.toLocaleString('ko-KR')}곳
                </strong>
                <span className="text-[10px] text-[#8E8E93] block">해당 월 수거 참여</span>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-white dark:bg-[#1C1C1E] p-2.5 rounded-xl border border-black/5 dark:border-white/10 flex sm:flex-col justify-between items-center sm:items-start">
                <div>
                  <span className="text-[10.5px] text-[#8E8E93] block font-medium">
                    {dashboard.collection.isPartialMonth ? '전주차 대비' : '전월 대비'}
                  </span>
                  <strong
                    className={`text-[13.5px] font-bold block mt-0.5 ${
                      dashboard.collection.isPartialMonth && dashboard.collection.weeklyComparison?.changePercent != null
                        ? dashboard.collection.weeklyComparison.changePercent > 0
                          ? 'text-[#315C36] dark:text-[#34C759]'
                          : dashboard.collection.weeklyComparison.changePercent < 0
                            ? 'text-[#C5221F] dark:text-[#FF6961]'
                            : 'text-[#1D1D1F] dark:text-[#F5F5F7]'
                        : dashboard.collection.changePercent != null && dashboard.collection.changePercent > 0
                          ? 'text-[#315C36] dark:text-[#34C759]'
                          : dashboard.collection.changePercent != null && dashboard.collection.changePercent < 0
                            ? 'text-[#C5221F] dark:text-[#FF6961]'
                            : 'text-[#1D1D1F] dark:text-[#F5F5F7]'
                    }`}
                  >
                    {dashboard.collection.isPartialMonth
                      ? dashboard.collection.weeklyComparison?.changePercent != null
                        ? `${dashboard.collection.weeklyComparison.changePercent > 0 ? '+' : ''}${dashboard.collection.weeklyComparison.changePercent.toFixed(1)}%`
                        : '수거 진행 중'
                      : dashboard.collection.changePercent != null
                        ? `${dashboard.collection.changePercent > 0 ? '+' : ''}${dashboard.collection.changePercent.toFixed(1)}%`
                        : '비교 기준 없음'}
                  </strong>
                  <span className="text-[10px] text-[#8E8E93] block mt-0.5">
                    {dashboard.collection.isPartialMonth && dashboard.collection.samePeriodComparison?.changePercent != null
                      ? `동기간 대비 ${dashboard.collection.samePeriodComparison.changePercent > 0 ? '+' : ''}${dashboard.collection.samePeriodComparison.changePercent.toFixed(1)}%`
                      : dashboard.collection.isPartialMonth
                        ? '주차 진행 중'
                        : '전월 실적 대비'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDashboardModal(true)}
                  className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-bold text-[#315C36] dark:text-[#34C759] hover:underline cursor-pointer"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>상세 대시보드 ↗</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-2 text-xs text-[#8E8E93]">
              해당 월은 수거관리 시트에 등록된 데이터가 없습니다. (부숙관리 현장 하역 기록 기준으로 작성됩니다)
            </div>
          )}
        </div>

        <button
          type="button"
          className="ai-request-card__run"
          onClick={() => void runReport(false)}
          disabled={busy || !collectionReady}
        >
          {busy || !collectionReady ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>
            {busy ? '표준 보고서를 생성하는 중입니다...' : !collectionReady ? '수거 자료 확인 중' : '표준 월간 현황 보고서 보기 ✦'}
          </span>
        </button>

        {error && (
          <p className="ai-request-card__error" role="alert">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </p>
        )}
      </section>

      {/* 지난 리포트 — 다시 열어도 AI 를 부르지 않는다 */}
      {history.length > 0 && (
        <section className="ai-history" aria-label="지난 리포트">
          <InfoHeading
            title={<h3>최근 결과 · 지난 리포트</h3>}
            label="지난 리포트"
            note={`이 기기의 브라우저에만 최근 ${HISTORY_LIMIT}개까지 보관됩니다 (구글 시트·드라이브에는 올라가지 않음). 다른 기기에서는 보이지 않고, 브라우저 데이터를 지우면 함께 사라집니다. 파일로 남기려면 리포트를 열고 [인쇄 · PDF 저장]을 누르세요.`}
          />
          <ul>
            {history.map(item => (
              <li key={item.id + item.createdAt} className="ai-history__item">
                <button
                  type="button"
                  className="ai-history__open"
                  onClick={() => {
                    setReport(item);
                    setReportReused(true);
                  }}
                >
                  <FileText className="w-4 h-4" />
                  <span className="ai-history__title">{item.sections.headline}</span>
                  <span className="ai-history__meta">
                    {item.facts.period.label} · {AUDIENCE_LABELS[item.audience]}
                  </span>
                </button>
                <button
                  type="button"
                  className="ai-history__delete"
                  aria-label={`${item.sections.headline} 삭제`}
                  title="삭제"
                  onClick={() => deleteFromHistory(item)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
