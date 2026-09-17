import React, { useState, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  TrendingDown,
  Info,
  Flame,
  X,
  MessageSquareQuote,
  ChevronRight,
} from 'lucide-react';
import type { CycleStatus } from '../../utils/fieldOps';
import type { CompostSettings, BeddingStage } from '../../types';
import { FIELD_OPS } from '../../constants/fieldOps';
import { SourceBadge } from '../ui/SourceBadge';

interface BeddingAdvisorChatProps {
  status: CycleStatus;
  settings: CompostSettings;
}

const STAGE_CONFIG: Record<
  BeddingStage,
  {
    badgeClass: string;
    bgClass: string;
    icon: React.ElementType;
    iconColor: string;
  }
> = {
  accumulating: {
    badgeClass: 'bg-black/5 dark:bg-white/10 text-[#6E6E73] dark:text-[#8E8E93]',
    bgClass: 'bg-[#F2F2F7]/80 dark:bg-[#2C2C2E]/60 border-black/5 dark:border-white/10',
    icon: Sparkles,
    iconColor: 'text-[#6E6E73] dark:text-[#8E8E93]',
  },
  managing: {
    badgeClass: 'bg-[#007AFF]/10 text-[#0062CC] dark:text-[#0A84FF]',
    bgClass: 'bg-[#007AFF]/5 dark:bg-[#0A84FF]/10 border-[#007AFF]/20',
    icon: Flame,
    iconColor: 'text-[#0062CC] dark:text-[#0A84FF]',
  },
  preparing: {
    badgeClass: 'bg-[#315C36]/15 text-[#315C36] dark:text-[#34C759]',
    bgClass: 'bg-[#315C36]/5 dark:bg-[#34C759]/10 border-[#315C36]/20',
    icon: TrendingDown,
    iconColor: 'text-[#315C36] dark:text-[#34C759]',
  },
  candidate: {
    badgeClass: 'bg-[#315C36] text-white dark:bg-[#34C759] dark:text-[#04260C]',
    bgClass:
      'bg-gradient-to-br from-[#F0FDF4] to-white dark:from-[#142618] dark:to-[#1C1C1E] border-[#315C36]/30 dark:border-[#34C759]/40',
    icon: CheckCircle2,
    iconColor: 'text-[#315C36] dark:text-[#34C759]',
  },
  attention: {
    badgeClass: 'bg-[#FF9F0A]/15 text-[#D97706] dark:text-[#FF9F0A]',
    bgClass:
      'bg-gradient-to-br from-[#FFFBEB] to-white dark:from-[#261E14] dark:to-[#1C1C1E] border-[#FF9F0A]/30 dark:border-[#FF9F0A]/40',
    icon: AlertTriangle,
    iconColor: 'text-[#D97706] dark:text-[#FF9F0A]',
  },
  hold: {
    badgeClass: 'bg-[#FF3B30]/15 text-[#C5221F] dark:text-[#FF453A]',
    bgClass:
      'bg-gradient-to-br from-[#FEF2F2] to-white dark:from-[#291717] dark:to-[#1C1C1E] border-[#FF3B30]/25 dark:border-[#FF453A]/30',
    icon: PauseCircle,
    iconColor: 'text-[#C5221F] dark:text-[#FF453A]',
  },
};

/**
 * 아이콘 버튼 형태로 컴팩트하게 노출되며,
 * 클릭 시 깔개 활용 진단 브리핑 모달이 열리는 컴포넌트. AI 를 부르지 않고 코드 판정만 보여 준다.
 */
export const BeddingAdvisorChat: React.FC<BeddingAdvisorChatProps> = ({ status, settings }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isGoalReached = (status.targetPileKg ?? 0) > 0 && status.currentPileKg >= (status.targetPileKg ?? 0);
  const cfg = STAGE_CONFIG[status.stage] || STAGE_CONFIG.accumulating;
  const StageIcon = cfg.icon;

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* 1. 컴팩트 아이콘 버튼 트리거 (그래프 하단에 깔끔한 1줄 배너로 배치) */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-xs hover:border-[#315C36]/40 dark:hover:border-[#34C759]/40 active:scale-[0.99] transition-all group"
        title="깔개 활용 진단 브리핑 보기"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative w-8 h-8 rounded-full bg-[#315C36] dark:bg-[#34C759] text-white dark:text-[#04260C] flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <Bot className="w-4.5 h-4.5" />
            {status.stage === 'attention' && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#FF9F0A] ring-2 ring-white dark:ring-[#1C1C1E] animate-pulse" />
            )}
            {status.stage === 'candidate' && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#34C759] ring-2 ring-white dark:ring-[#1C1C1E]" />
            )}
          </div>
          <div className="text-left min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] group-hover:text-[#315C36] dark:group-hover:text-[#34C759] transition-colors truncate">
                깔개 활용 진단 브리핑
              </span>
              <SourceBadge kind="computed" />
            </div>
            <p className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93] truncate mt-0.5">
              저장된 기록으로 계산한 판단 근거 보기
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.badgeClass}`}>
            {status.stageTitle}
          </span>
          <ChevronRight className="w-4 h-4 text-[#8E8E93] group-hover:translate-x-0.5 transition-transform" />
        </div>
      </button>

      {/* 2. 클릭 시 열리는 대화형 챗봇 모달 (바텀시트/모달) */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="advisor-dialog-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          {/* 모달 본문 (모바일 바텀시트 + 데스크톱 다이얼로그) */}
          <div
            className={`w-full max-w-lg rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden transition-all duration-300 max-h-[85vh] flex flex-col ${cfg.bgClass}`}
            onClick={e => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-black/5 dark:border-white/10 shrink-0 bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[#315C36] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3
                      id="advisor-dialog-title"
                      className="font-bold text-sm text-[#1D1D1F] dark:text-[#F5F5F7] truncate"
                    >
                      지소행 현장 어드바이저
                    </h3>
                    <SourceBadge kind="computed" />
                  </div>
                  <span className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93] block truncate">
                    {status.ranchName} 현장 데이터 기준
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${cfg.badgeClass} flex items-center gap-1`}>
                  <StageIcon className="w-3.5 h-3.5" />
                  {status.stageTitle}
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center text-[#6E6E73] dark:text-[#8E8E93] transition-colors"
                  aria-label="닫기"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 모달 스크롤 본문 */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5">
              {/* 챗봇 대화 말풍선 */}
              <div className="relative p-4 rounded-2xl bg-white/95 dark:bg-[#1C1C1E]/95 border border-black/5 dark:border-white/10 shadow-xs space-y-3">
                {/* 목표량 도달 여부 배너 */}
                {status.targetPileKg && (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-[#F2F2F7] dark:bg-[#2C2C2E]/60 text-xs text-[#1D1D1F] dark:text-[#F5F5F7]">
                    <span className="font-bold shrink-0 mt-0.5">
                      {isGoalReached ? '🎯 목표량 달성' : '⏳ 목표량 축적 중'}
                    </span>
                    <span className="text-[11.5px] text-[#6E6E73] dark:text-[#8E8E93] leading-relaxed">
                      {isGoalReached
                        ? `현재 더미량(${status.currentPileKg.toLocaleString('ko-KR')}kg)이 목표(${status.targetPileKg.toLocaleString('ko-KR')}kg)를 충족했습니다. 깔개 활용 가능 조건을 검토합니다.`
                        : `현재 ${status.currentPileKg.toLocaleString('ko-KR')}kg / 목표 ${status.targetPileKg.toLocaleString('ko-KR')}kg (${status.progressPercent}%). 목표량 도달 전이라도 필요 시 소량의 깔개 활용이 가능합니다.`}
                    </span>
                  </div>
                )}

                {/* 판정 이유 — 코드가 정한 문장 */}
                <div className="flex gap-2.5 items-start">
                  <MessageSquareQuote className="w-5 h-5 text-[#315C36] dark:text-[#34C759] shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-[13px] text-[#1D1D1F] dark:text-[#E5E5EA] leading-relaxed break-keep font-semibold">
                    "{status.stageReason}"
                  </p>
                </div>

                {/* 중간 소량 깔개 활용 확인 안내 */}
                {status.beddingUsedKg > 0 ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#315C36] dark:text-[#34C759] pt-1">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      이번 사이클에서 깔개 활용 {status.beddingUsedKg.toLocaleString('ko-KR')}kg 기록이 정상 반영되어 있습니다.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-[#6E6E73] dark:text-[#8E8E93] pt-0.5">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>현재까지 깔개 활용 기록은 0kg입니다 (미사용).</span>
                  </div>
                )}

                {/* 현장 관찰 가이드 팁 */}
                <div className="pt-2.5 border-t border-black/5 dark:border-white/10 space-y-2 text-[11px] text-[#6E6E73] dark:text-[#8E8E93]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <SourceBadge kind="observed" />
                    <span>
                      부숙·건조가 정상이면 3~4주 뒤 함수율 {settings.usableMoistureMin}~{settings.usableMoistureMax}% 로
                      내려가는 경향이 있습니다 (현장 관찰 기준).
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <SourceBadge kind="observed" />
                    <span>
                      혼합(기존 커피박을 삽으로 한 번씩 뒤집기)은 1주일에 {FIELD_OPS.mixingWeeklyMin}~{FIELD_OPS.mixingWeeklyMax}회를 목표로 하여 산소 공급을 유지합니다.
                    </span>
                  </div>
                  {status.dataGaps.map(gap => (
                    <div key={gap} className="flex items-start gap-1.5 text-[#D97706] dark:text-[#FF9F0A] font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span className="break-keep">{gap}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 하단 닫기 버튼 */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full py-2.5 rounded-xl bg-[#315C36] dark:bg-[#34C759] text-white dark:text-[#04260C] text-xs font-bold shadow-xs hover:opacity-90 active:scale-[0.98] transition-all"
              >
                확인 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
