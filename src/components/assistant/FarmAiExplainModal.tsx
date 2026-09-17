import React, { useEffect } from 'react';
import {
  X,
  Sparkles,
  RefreshCw,
  Share2,
  Thermometer,
  Droplets,
  Scale,
  ShieldCheck,
  Calendar,
  Layers,
} from 'lucide-react';
import type { FarmReportData } from '../../services/reportData';

interface FarmAiExplainModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmData: FarmReportData;
  aiExplanation: string | null;
  aiModel: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenExport?: () => void;
}

export const FarmAiExplainModal: React.FC<FarmAiExplainModalProps> = ({
  isOpen,
  onClose,
  farmData,
  aiExplanation,
  aiModel,
  isLoading,
  onRefresh,
  onOpenExport,
}) => {
  // ESC 키로 닫기 지원
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { farm, period, pile, condition, bedding, actions } = farmData;

  // 깔개 상태 뱃지 스타일 매핑
  const getBeddingBadge = (status: string) => {
    switch (status) {
      case 'candidate':
        return {
          bg: 'bg-[#2D6A4F]/15 text-[#2D6A4F] dark:bg-[#4ADE80]/20 dark:text-[#4ADE80] border-[#2D6A4F]/30',
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
      default:
        return {
          bg: 'bg-red-500/15 text-red-700 dark:bg-red-400/20 dark:text-red-300 border-red-500/30',
          dot: 'bg-red-500',
        };
    }
  };

  const badge = getBeddingBadge(bedding.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md transition-all animate-in fade-in duration-200"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-modal-title"
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/15 rounded-3xl shadow-2xl overflow-hidden transition-all">
        {/* ── 상단 그라데이션 액센트 라인 ── */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#2D6A4F] via-[#52B788] to-[#4ADE80]" />

        {/* ── 헤더 ── */}
        <div className="flex items-start justify-between px-5 sm:px-6 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#2D6A4F] to-[#1B4332] text-white flex items-center justify-center shadow-md shadow-[#2D6A4F]/20 shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 text-[#74C69D]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-[#2D6A4F]/10 text-[#2D6A4F] dark:bg-[#4ADE80]/20 dark:text-[#4ADE80]">
                  지소행 AI 어시스턴트
                </span>
                <span className="text-[11px] font-medium text-[#8E8E93] flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {period.label} ({period.start} ~ {period.end})
                </span>
              </div>
              <h2 id="ai-modal-title" className="text-lg sm:text-xl font-extrabold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {farm.name} 부숙 현황 AI 종합 진단
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── 본문 스크롤 영역 ── */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5 text-[#1D1D1F] dark:text-[#F5F5F7]">
          {/* 1. 로딩 상태 */}
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-[#2D6A4F]/20 border-t-[#2D6A4F] dark:border-t-[#4ADE80] animate-spin" />
                <Sparkles className="w-6 h-6 text-[#2D6A4F] dark:text-[#4ADE80] absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold">현장 데이터 분석 중...</h3>
                <p className="text-xs text-[#8E8E93] max-w-sm">
                  심부온도, 함수율, 혼합 이력 및 깔개 적합도 기준을 바탕으로 맞춤형 현장 진단 소견을 생성하고 있습니다.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 2. 핵심 지표 한눈에 보기 카드 그리드 */}
              <div>
                <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider block mb-2">
                  핵심 현장 지표 요약
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* 심부 온도 */}
                  <div className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[#8E8E93] text-[11px] font-medium">
                      <span className="flex items-center gap-1">
                        <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                        심부 온도
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className="text-xl font-black tracking-tight">
                        {condition.temperature !== null ? `${condition.temperature}℃` : '-'}
                      </span>
                      <span className="text-[10px] text-[#8E8E93] block font-medium">
                        {condition.temperatureTrendLabel}
                      </span>
                    </div>
                  </div>

                  {/* 함수율 */}
                  <div className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[#8E8E93] text-[11px] font-medium">
                      <span className="flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5 text-blue-500" />
                        함수율
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className="text-xl font-black tracking-tight">
                        {condition.moisture !== null ? `${condition.moisture}%` : '-'}
                      </span>
                      <span className="text-[10px] text-[#8E8E93] block font-medium">
                        {condition.moistureTrendLabel}
                      </span>
                    </div>
                  </div>

                  {/* 추정 더미량 */}
                  <div className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[#8E8E93] text-[11px] font-medium">
                      <span className="flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5 text-[#2D6A4F] dark:text-[#4ADE80]" />
                        추정 더미량
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className="text-xl font-black tracking-tight text-[#2D6A4F] dark:text-[#4ADE80]">
                        {pile.currentKg.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[#8E8E93] block font-medium">
                        누적 {pile.addedKg.toLocaleString()}kg
                      </span>
                    </div>
                  </div>

                  {/* 깔개 사용 판정 */}
                  <div className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[#8E8E93] text-[11px] font-medium">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        깔개 판단
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${badge.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        {bedding.statusLabel}
                      </span>
                      <span className="text-[10px] text-[#8E8E93] block font-medium mt-0.5">
                        혼합 7일 {farmData.management.mixingCountLast7Days}회
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. AI 종합 진단 소견 본문 카드 */}
              <div className="relative p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-500/[0.07] to-[#2D6A4F]/[0.12] dark:from-emerald-950/30 dark:to-[#1B4332]/40 border border-emerald-500/25 dark:border-emerald-500/30 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2D6A4F] dark:text-[#4ADE80]">
                    <Sparkles className="w-4 h-4 text-[#2D6A4F] dark:text-[#4ADE80]" />
                    AI 현장 진단 소견
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold">
                    {aiModel ?? 'Gemini Flash'}
                  </span>
                </div>

                <p className="text-sm sm:text-[14.5px] leading-relaxed font-medium text-[#1D1D1F] dark:text-[#F5F5F7] whitespace-pre-line">
                  {aiExplanation || '현재 더미의 부숙 상태 및 환경 지표가 관리 중입니다. 다음 방문 시 온도와 함수율을 체크해주세요.'}
                </p>

                <div className="pt-2 border-t border-emerald-500/15 text-[11px] text-[#6E6E73] dark:text-[#8E8E93] flex items-center justify-between">
                  <span>* 판정 수치는 현장 실측 데이터 연산 기준이며, 문장은 AI 해설입니다.</span>
                </div>
              </div>

              {/* 4. 코드 연산 판단 근거 및 종합 안내 */}
              <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#8E8E93]">
                  <Layers className="w-3.5 h-3.5 text-[#2D6A4F] dark:text-[#4ADE80]" />
                  <span>운영 가이드 및 판단 근거</span>
                </div>
                <p className="text-xs sm:text-[13px] leading-relaxed text-[#1D1D1F] dark:text-[#E5E5EA]">
                  {bedding.notice}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {bedding.reasons.map((r, i) => (
                    <span
                      key={i}
                      className="text-[11px] px-2.5 py-0.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] text-[#6E6E73] dark:text-[#A1A1A6] font-medium"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              {/* 5. 지금 바로 권장하는 조치사항 */}
              {actions.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider block">
                    우선 권장 조치사항 (TOP {actions.length})
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {actions.map((act, idx) => (
                      <div
                        key={act.id}
                        className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                          act.priority === 'high'
                            ? 'bg-red-500/[0.03] border-red-500/20 dark:bg-red-950/15'
                            : 'bg-black/[0.02] border-black/[0.06] dark:bg-white/[0.03] dark:border-white/[0.08]'
                        }`}
                      >
                        <span className="text-xs font-bold font-mono text-[#8E8E93] mt-0.5">
                          0{idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <strong className="text-xs sm:text-[13px] font-bold">
                              {act.title}
                            </strong>
                            {act.priority === 'high' && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/15 text-red-600 dark:text-red-400 font-bold">
                                긴급
                              </span>
                            )}
                          </div>
                          <p className="text-[11.5px] text-[#6E6E73] dark:text-[#8E8E93] mt-0.5">
                            {act.reason}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── 푸터 ── */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-2 bg-black/[0.01] dark:bg-white/[0.01]">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>AI 다시 분석</span>
          </button>

          <div className="flex items-center gap-2">
            {onOpenExport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenExport();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#2D6A4F] hover:bg-[#1B4332] text-white shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>내보내기 📤</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[#1D1D1F] dark:text-[#F5F5F7] transition-all cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
