import React, { useState } from 'react';
import {
  ArrowLeft,
  Printer,
  Sparkles,
  Info,
  Calendar,
  Layers,
  Thermometer,
  Droplets,
  RotateCw,
  Bug,
  ListTodo,
  Clock,
  Loader2,
  CheckSquare,
  Square,
  ShieldCheck,
} from 'lucide-react';
import type { FarmReportData, FarmBeddingStatus } from '../../services/reportData';
import { requestFarmAiExplanation } from '../../services/aiReport';
import { getVisitEvents } from '../../utils/fieldOps';

interface Props {
  data: FarmReportData;
  webhookUrl?: string;
  onBack: () => void;
  onNavigateAction?: (actionId?: string) => void;
}

export const FarmReportView: React.FC<Props> = ({
  data,
  webhookUrl = '',
  onBack,
  onNavigateAction,
}) => {
  // 체크리스트 상태
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const toggleCheck = (idx: number) => {
    setCheckedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // AI 설명 온디맨드 로딩 및 캐시 상태
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiModel, setAiModel] = useState<string | null>(null);

  const handleFetchAiExplanation = async () => {
    if (aiExplanation || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await requestFarmAiExplanation(webhookUrl, data);
      if (res.success) {
        setAiExplanation(res.explanation);
        setAiModel(res.model ?? 'Gemini AI');
      }
    } catch {
      setAiExplanation('현재 더미의 부숙 상태 및 환경 지표가 관리 중입니다. 다음 방문 시 온도와 함수율을 체크해주세요.');
    } finally {
      setAiLoading(false);
    }
  };

  const { farm, period, pile, condition, management, bedding, actions, nextVisitChecklist, recentRecords } = data;

  // 깔개 상태별 뱃지 스타일
  const getBeddingBadge = (status: FarmBeddingStatus) => {
    switch (status) {
      case 'candidate':
        return {
          bg: 'bg-[#2D6A4F]/15 text-[#2D6A4F] dark:bg-[#4ADE80]/20 dark:text-[#4ADE80] border-[#2D6A4F]/30 dark:border-[#4ADE80]/40',
          dot: 'bg-[#2D6A4F] dark:bg-[#4ADE80]',
        };
      case 'preparing':
        return {
          bg: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-500',
        };
      case 'managing':
        return {
          bg: 'bg-blue-500/15 text-blue-700 dark:bg-blue-400/20 dark:text-blue-300 border-blue-500/30',
          dot: 'bg-blue-500',
        };
      case 'accumulating':
        return {
          bg: 'bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300 border-amber-500/30',
          dot: 'bg-amber-500',
        };
      case 'hold':
        return {
          bg: 'bg-red-500/15 text-red-700 dark:bg-red-400/20 dark:text-red-300 border-red-500/30',
          dot: 'bg-red-500',
        };
      default:
        return {
          bg: 'bg-zinc-500/15 text-zinc-700 dark:bg-zinc-400/20 dark:text-zinc-300 border-zinc-500/30',
          dot: 'bg-zinc-500',
        };
    }
  };

  const badgeStyle = getBeddingBadge(bedding.status);

  return (
    <div className="farm-report-wrapper w-full max-w-5xl mx-auto px-4 py-5 space-y-6 pb-24 text-[#1D1D1F] dark:text-[#F5F5F7]">
      {/* ── 상단 액션바 (인쇄 시 숨김) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/70 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.12] p-3 rounded-2xl shadow-sm print:hidden">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>어시스턴트로 돌아가기</span>
        </button>

        <div className="flex items-center gap-2">
          {!aiExplanation ? (
            <button
              type="button"
              onClick={handleFetchAiExplanation}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{aiLoading ? 'AI 분석 중...' : 'AI 설명 보기 ✦'}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[#1D1D1F] dark:text-[#F5F5F7] transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>인쇄 · PDF 저장</span>
          </button>
        </div>
      </div>

      {/* ── 리포트 헤더 ── */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-black/[0.08] dark:border-white/[0.12] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-[#2D6A4F]/10 text-[#2D6A4F] dark:bg-[#4ADE80]/20 dark:text-[#4ADE80]">
              목장 내부용 현장 운영 보고서
            </span>
            <span className="text-xs text-[#8E8E93] flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {period.label} ({period.start} ~ {period.end})
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {farm.name} 커피박 관리 현황
          </h1>
          <p className="text-xs text-[#8E8E93] mt-1">
            운영 방식: {farm.operationTypeLabel}
          </p>
        </div>

        <div className="text-left sm:text-right">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-black/10 dark:border-white/15 bg-white/60 dark:bg-black/40">
            <span className={`w-2 h-2 rounded-full ${badgeStyle.dot}`} />
            <span>{bedding.statusLabel}</span>
          </div>
          <span className="block text-[11px] text-[#8E8E93] mt-1">
            부숙관리 실측 데이터 기준 · 생성 {new Date(data.generatedAt).toLocaleDateString('ko-KR')}
          </span>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════
          01 현재 상태 (빅 넘버 & 핵심 지표 그리드)
      ════════════════════════════════════════════════════════════ */}
      <section aria-label="01 현재 상태" className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight text-[#8E8E93] flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#2D6A4F] dark:text-[#4ADE80]" />
            <span>01 현재 상태 요약</span>
          </h2>
          <span className="text-[11px] text-[#8E8E93] font-medium">
            마지막 점검: {management.daysSinceLastVisit !== null ? `${management.daysSinceLastVisit}일 전` : '기록 없음'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* 현재 추정 더미량 */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[#8E8E93]">현재 추정 더미량</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">[계산]</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <strong className="text-2xl font-black tracking-tight text-[#2D6A4F] dark:text-[#4ADE80]">
                {pile.currentKg.toLocaleString()}
              </strong>
              <span className="text-xs font-semibold text-[#8E8E93]">kg</span>
            </div>
            <span className="text-[10px] text-[#8E8E93] block mt-1 truncate" title={pile.accumulationBasis}>
              누적 투입 {pile.addedKg.toLocaleString()}kg - 깔개 {pile.usedKg.toLocaleString()}kg
            </span>
          </div>

          {/* 현재 함수율 */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[#8E8E93]">현재 함수율</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">[실측]</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <strong className="text-2xl font-black tracking-tight">
                {condition.moisture !== null ? `${condition.moisture}%` : '-'}
              </strong>
              <span className="text-xs font-medium text-[#8E8E93] ml-1">
                ({condition.moistureTrendLabel})
              </span>
            </div>
            <span className="text-[10px] text-[#8E8E93] block mt-1">
              관찰 범위 20~30% <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-500/10">[현장 관찰]</span>
            </span>
          </div>

          {/* 심부 온도 */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[#8E8E93]">현재 심부온도</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">[실측]</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <strong className="text-2xl font-black tracking-tight">
                {condition.temperature !== null ? `${condition.temperature}℃` : '-'}
              </strong>
              <span className="text-xs font-medium text-[#8E8E93] ml-1">
                ({condition.temperatureTrendLabel})
              </span>
            </div>
            <span className="text-[10px] text-[#8E8E93] block mt-1">
              발열 및 호기성 발효 상태
            </span>
          </div>

          {/* 최근 7일 혼합 & 곰팡이 */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[#8E8E93]">혼합 & 곰팡이</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">[종합]</span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <div>
                <span className="text-xs text-[#8E8E93]">혼합 7일 </span>
                <strong className="text-lg font-bold">
                  {management.mixingCountLast7Days}회
                </strong>
              </div>
              <div className="text-right">
                <span className="text-xs text-[#8E8E93]">곰팡이 </span>
                <strong className={`text-xs font-bold ${condition.moldStatus === 'none' ? 'text-[#2D6A4F] dark:text-[#4ADE80]' : condition.moldStatus === 'unknown' ? 'text-[#8E8E93]' : 'text-red-500'}`}>
                  {condition.moldStatusLabel}
                </strong>
              </div>
            </div>
            <span className="text-[10px] text-[#8E8E93] block mt-1">
              {management.recommendedWeeklyMixing}
            </span>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          02 깔개 사용 판단 (핵심 판정 카드)
      ════════════════════════════════════════════════════════════ */}
      <section aria-label="02 깔개 사용 판단" className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] shadow-sm space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#2D6A4F] dark:text-[#4ADE80]" />
              <span>02 깔개 사용 판단</span>
            </h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
              [코드 연산 판정]
            </span>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${badgeStyle.bg}`}>
            {bedding.statusLabel}
          </div>
        </div>

        {/* 종합 안내 문구 (순수 코드 템플릿) */}
        <div className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] text-xs sm:text-[13px] leading-relaxed font-medium">
          {bedding.notice}
        </div>

        {/* 판단 근거 리스트 */}
        <div>
          <span className="text-xs font-bold text-[#8E8E93] block mb-1.5">판단 근거 지표</span>
          <div className="flex flex-wrap gap-2">
            {bedding.reasons.map((reason, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] font-medium"
              >
                {reason}
              </span>
            ))}
          </div>
        </div>

        {/* 온디맨드 AI 설명 영역 (사용자가 버튼 눌렀을 때만 표시) */}
        {aiExplanation && (
          <div className="mt-2 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#2D6A4F] dark:text-[#4ADE80] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI 현장 상태 요약 ({aiModel})
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                [AI 제안]
              </span>
            </div>
            <p className="text-xs sm:text-[13px] text-[#1D1D1F] dark:text-[#F5F5F7] leading-relaxed">
              {aiExplanation}
            </p>
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════
          03 지금 해야 할 일 (가장 중요한 영역)
      ════════════════════════════════════════════════════════════ */}
      <section aria-label="03 지금 해야 할 일" className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight text-[#8E8E93] flex items-center gap-1.5">
            <ListTodo className="w-4 h-4 text-[#2D6A4F] dark:text-[#4ADE80]" />
            <span>03 지금 해야 할 일 (우선순위 TOP {actions.length})</span>
          </h2>
          <span className="text-[11px] text-[#8E8E93]">상태 데이터 기반 자동 추천</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {actions.map((act, index) => (
            <div
              key={act.id}
              className={`p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border transition-all ${
                act.priority === 'high'
                  ? 'border-red-500/30 dark:border-red-500/40 shadow-sm ring-1 ring-red-500/20'
                  : 'border-black/[0.08] dark:border-white/[0.12] shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-[#8E8E93]">
                  0{index + 1}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    act.priority === 'high'
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                      : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {act.priority === 'high' ? '우선 조치' : '권장 사항'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5">
                {act.title}
              </h3>
              <p className="text-xs text-[#6E6E73] dark:text-[#8E8E93] leading-relaxed">
                {act.reason}
              </p>
              {onNavigateAction && act.actionId && (
                <button
                  type="button"
                  onClick={() => onNavigateAction(act.actionId)}
                  className="mt-3 text-xs font-semibold text-[#2D6A4F] dark:text-[#4ADE80] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>해당 작업 바로가기 →</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          04 커피박 축적 현황 (현재 더미량 & 목표량)
      ════════════════════════════════════════════════════════════ */}
      <section aria-label="04 커피박 축적 현황" className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#2D6A4F] dark:text-[#4ADE80]" />
            <span>04 커피박 축적 현황 (현재 더미량)</span>
          </h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
            [계산: 누적 투입 - 깔개 사용]
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div className="space-y-1.5">
            <div className="flex items-baseline gap-2">
              <strong className="text-3xl font-black text-[#2D6A4F] dark:text-[#4ADE80]">
                {pile.currentKg.toLocaleString()}
              </strong>
              <span className="text-sm font-semibold text-[#8E8E93]">kg 보유</span>
              {pile.targetKg && (
                <span className="text-xs text-[#8E8E93]">
                  / 목표 {pile.targetKg.toLocaleString()}kg ({pile.progressPct}%)
                </span>
              )}
            </div>

            {/* 목표량 프로그레스 바 (설정 시에만) */}
            {pile.targetKg ? (
              <div className="w-full">
                <div className="w-full h-2.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden mt-2">
                  <div
                    className="h-full bg-[#2D6A4F] dark:bg-[#4ADE80] transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(pile.progressPct ?? 0, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-[#8E8E93] mt-1">
                  <span>진행률 {pile.progressPct}%</span>
                  <span>
                    {(pile.targetKg - pile.currentKg) > 0
                      ? `목표까지 약 ${(pile.targetKg - pile.currentKg).toLocaleString()}kg 남음`
                      : '목표량 도달 완료'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#8E8E93] bg-black/[0.02] dark:bg-white/[0.03] p-2.5 rounded-xl border border-black/5 dark:border-white/5">
                <span className="font-semibold block text-[#1D1D1F] dark:text-[#F5F5F7]">
                  깔개 목표량 미설정 (현재 상태 관리 중)
                </span>
                축사 교체 주기 및 면적에 맞는 목표량을 설정하면 적정 깔개 사용 시점을 함께 파악할 수 있습니다.
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-[#8E8E93]">누적 신규 투입량:</span>
              <strong className="font-semibold">{pile.addedKg.toLocaleString()} kg</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8E8E93]">누적 깔개 사용량:</span>
              <strong className="font-semibold">{pile.usedKg.toLocaleString()} kg</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8E8E93]">최근 신규 투입:</span>
              <strong className="font-semibold">
                {pile.latestInputDate ? `${pile.latestInputDate} (${pile.latestInputKg?.toLocaleString()}kg)` : '기록 없음'}
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          05 온도·함수율 변화 및 신규 투입 이벤트
      ════════════════════════════════════════════════════════════ */}
      <section aria-label="05 온도 함수율 변화" className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-[#2D6A4F] dark:text-[#4ADE80]" />
            <span>05 온도·함수율 변화 추이</span>
          </h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
            [실측 + 신규 투입 이벤트]
          </span>
        </div>

        {/* 신규 투입 후 영향 안내 문구 */}
        {condition.recentImpactNote && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>{condition.recentImpactNote}</span>
          </div>
        )}

        {/* 최근 측정값 타임라인 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 심부온도 변화 */}
          <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-red-500" />
                심부 온도 ({condition.temperatureTrendLabel})
              </span>
              <span className="text-[11px] text-[#8E8E93]">
                현재: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{condition.temperature ?? '-'}℃</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {condition.temperaturePoints.length > 0 ? (
                condition.temperaturePoints.map((val, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 text-xs font-bold">
                      {val}℃
                    </span>
                    {idx < condition.temperaturePoints.length - 1 && (
                      <span className="text-[#8E8E93] text-xs">→</span>
                    )}
                  </div>
                ))
              ) : (
                <span className="text-xs text-[#8E8E93]">측정 기록 부족</span>
              )}
            </div>
          </div>

          {/* 함수율 변화 */}
          <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-blue-500" />
                함수율 ({condition.moistureTrendLabel})
              </span>
              <span className="text-[11px] text-[#8E8E93]">
                현재: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{condition.moisture ?? '-'}%</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {condition.moisturePoints.length > 0 ? (
                condition.moisturePoints.map((val, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 text-xs font-bold">
                      {val}%
                    </span>
                    {idx < condition.moisturePoints.length - 1 && (
                      <span className="text-[#8E8E93] text-xs">→</span>
                    )}
                  </div>
                ))
              ) : (
                <span className="text-xs text-[#8E8E93]">측정 기록 부족</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          06 혼합 및 곰팡이 관리
      ════════════════════════════════════════════════════════════ */}
      <section aria-label="06 혼합 및 곰팡이 관리" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 혼합 관리 */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <RotateCw className="w-4 h-4 text-[#2D6A4F] dark:text-[#4ADE80]" />
              <span>혼합 관리 현황</span>
            </h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              management.mixingLevel === 'ok'
                ? 'bg-[#2D6A4F]/10 text-[#2D6A4F] dark:bg-[#4ADE80]/20 dark:text-[#4ADE80]'
                : management.mixingLevel === 'low'
                  ? 'bg-amber-500/15 text-amber-600'
                  : 'bg-red-500/15 text-red-600'
            }`}>
              {management.mixingLevelLabel}
            </span>
          </div>
          <div className="text-xs text-[#6E6E73] dark:text-[#8E8E93] space-y-1">
            <p>• 최근 7일 혼합 횟수: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{management.mixingCountLast7Days}회</strong> ({management.recommendedWeeklyMixing})</p>
            <p>• 마지막 혼합 경과: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{management.daysSinceLastMixing !== null ? `${management.daysSinceLastMixing}일 전` : '기록 없음'}</strong></p>
            {management.mixingNotice && (
              <p className="text-red-500 font-medium mt-1">⚠ {management.mixingNotice}</p>
            )}
          </div>
        </div>

        {/* 곰팡이 관리 */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <Bug className="w-4 h-4 text-[#2D6A4F] dark:text-[#4ADE80]" />
              <span>곰팡이 육안 점검</span>
            </h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              condition.moldStatus === 'none'
                ? 'bg-[#2D6A4F]/10 text-[#2D6A4F] dark:bg-[#4ADE80]/20 dark:text-[#4ADE80]'
                : condition.moldStatus === 'unknown'
                  ? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400'
                  : 'bg-red-500/15 text-red-600'
            }`}>
              {condition.moldStatusLabel}
            </span>
          </div>
          <div className="text-xs text-[#6E6E73] dark:text-[#8E8E93] space-y-1">
            {condition.moldStatus === 'none' ? (
              <p className="text-[#2D6A4F] dark:text-[#4ADE80] font-medium">
                ✓ 최근 점검에서 곰팡이가 발견되지 않았습니다. 현재 호기성 통기 상태가 적절합니다.
              </p>
            ) : condition.moldStatus === 'partial' || condition.moldStatus === 'spreading' ? (
              <p className="text-red-500 font-medium">
                ⚠ 곰팡이가 확인되었습니다. 깔개 사용은 보류되며 즉시 전체 더미를 혼합하여 통기시켜야 합니다.
              </p>
            ) : (
              <p className="text-[#8E8E93]">
                최근 점검 기록에 곰팡이 상태가 누락되었습니다. 다음 방문 시 육안 확인을 진행해주세요.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          07 다음 방문 체크리스트
      ════════════════════════════════════════════════════════════ */}
      <section aria-label="07 다음 방문 체크리스트" className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-[#2D6A4F] dark:text-[#4ADE80]" />
            <span>07 다음 방문 현장 체크리스트</span>
          </h2>
          <span className="text-[11px] text-[#8E8E93]">현장 점검 시 체크하세요</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {nextVisitChecklist.map((item, idx) => {
            const isChecked = Boolean(checkedItems[idx]);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleCheck(idx)}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isChecked
                    ? 'bg-black/[0.02] dark:bg-white/[0.02] border-black/5 dark:border-white/5 opacity-60 line-through'
                    : 'bg-white dark:bg-[#1C1C1E] border-black/10 dark:border-white/10 hover:border-[#2D6A4F]/40'
                }`}
              >
                {isChecked ? (
                  <CheckSquare className="w-4 h-4 text-[#2D6A4F] dark:text-[#4ADE80] flex-shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 text-[#8E8E93] flex-shrink-0 mt-0.5" />
                )}
                <span className="text-xs font-medium leading-tight">
                  {item.text}
                  {item.priority === 'high' && (
                    <span className="ml-1.5 text-[10px] font-bold text-red-500">[필수]</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          08 최근 방문 기록 (최근 3~5건 카드)
      ════════════════════════════════════════════════════════════ */}
      <section aria-label="08 최근 방문 기록" className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.12] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#2D6A4F] dark:text-[#4ADE80]" />
            <span>08 최근 방문 실측 기록 (최근 {recentRecords.length}건)</span>
          </h2>
          <span className="text-[11px] text-[#8E8E93]">부숙관리 시트 연동 원본</span>
        </div>

        <div className="space-y-2">
          {recentRecords.map(rec => {
            const events = getVisitEvents(rec);
            return (
              <div
                key={rec.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {rec.date}
                  </span>
                  <div className="flex items-center gap-1">
                    {events.map((ev, i) => (
                      <span
                        key={i}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          ev.type === 'input'
                            ? 'bg-blue-500/15 text-blue-600'
                            : ev.type === 'mix'
                              ? 'bg-[#2D6A4F]/15 text-[#2D6A4F] dark:text-[#4ADE80]'
                              : ev.type === 'mold'
                                ? 'bg-red-500/15 text-red-600'
                                : 'bg-purple-500/15 text-purple-600'
                        }`}
                      >
                        {ev.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[#6E6E73] dark:text-[#8E8E93]">
                  <span>온도: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{rec.coreTemp > 0 ? `${rec.coreTemp}℃` : '-'}</strong></span>
                  <span>함수율: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{rec.moisture > 0 ? `${rec.moisture}%` : '-'}</strong></span>
                  <span>혼합: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{rec.mixed ? '완료' : '미진행'}</strong></span>
                  <span>곰팡이: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{rec.moldStatus === 'none' ? '없음' : rec.moldStatus ?? '기록 없음'}</strong></span>
                  {rec.collectedKg || rec.addedKg ? (
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                      +{Math.round(rec.addedKg ?? rec.collectedKg ?? 0).toLocaleString()}kg
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 하단 면책 및 데이터 출처 안내 (인쇄 시 포함) ── */}
      <footer className="pt-4 border-t border-black/[0.08] dark:border-white/[0.12] text-xs text-[#8E8E93] flex flex-wrap justify-between gap-2">
        <span>자료 출처: 목장 현장 부숙관리 대장 (카페 수거량 합산 없음)</span>
        <span>지소행 자원순환 사업단 · 스마트 축사 솔루션</span>
      </footer>
    </div>
  );
};
