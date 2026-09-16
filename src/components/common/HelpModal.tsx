import React from 'react';
import { X, BookOpen, CheckCircle2, Thermometer, Droplets } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/8 dark:border-white/12 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[#1D1D1F] dark:text-[#F5F5F7] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#315C36]/10 dark:bg-[#34C759]/20 text-[#315C36] dark:text-[#34C759] flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </span>
            <h3 id="help-modal-title" className="text-lg font-bold">
              현장 가이드 및 도움말
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/20 active:scale-95 transition-all"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="p-6 space-y-5 overflow-y-auto smooth-scroll text-xs sm:text-sm">
          {/* 섹션 1: 수분율 판정 기준 */}
          <div className="space-y-2">
            <h4 className="font-bold flex items-center gap-1.5 text-sm text-[#315C36] dark:text-[#34C759]">
              <Droplets className="w-4 h-4" /> 수분율 관리 및 깔개 투입 기준
            </h4>
            <div className="space-y-1.5 pl-5 border-l-2 border-[#315C36]/30 dark:border-[#34C759]/40 leading-relaxed text-[#6E6E73] dark:text-[#8E8E93]">
              <p>
                <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">25% ~ 45% (깔개 사용 가능)</strong>: 수분이 적정 수준으로 감량되어 유기물이 안정화된 상태입니다. 우사 바닥 깔개로 즉시 투입할 수 있습니다.
              </p>
              <p>
                <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">45% ~ 65% (부숙 진행 중)</strong>: 호기성 미생물이 왕성히 활동하는 단계로 주기적인 뒤집기(교반)가 필요합니다.
              </p>
              <p>
                <strong className="text-[#D97706] dark:text-[#FF9F0A]">65% 초과 (과습/확인 필요)</strong>: 공기 순환이 차단되어 혐기 발효(악취 발생) 위험이 있습니다. 마른 커피박을 혼합하거나 뒤집어 통기성을 확보하세요.
              </p>
            </div>
          </div>

          {/* 섹션 2: 심부 온도 관리 */}
          <div className="space-y-2">
            <h4 className="font-bold flex items-center gap-1.5 text-sm text-[#315C36] dark:text-[#34C759]">
              <Thermometer className="w-4 h-4" /> 심부 온도 기준
            </h4>
            <div className="space-y-1.5 pl-5 border-l-2 border-[#315C36]/30 dark:border-[#34C759]/40 leading-relaxed text-[#6E6E73] dark:text-[#8E8E93]">
              <p>
                <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">55℃ ~ 75℃ (고온 호기성 발효)</strong>: 병원균과 잡초 종자가 사멸하고 유기물이 빠르게 분해되는 가장 이상적인 온도입니다.
              </p>
              <p>
                <strong className="text-[#D97706] dark:text-[#FF9F0A]">75℃ 초과 (과열 주의)</strong>: 유익 미생물이 사멸할 수 있으므로 교반을 통해 열을 방출해야 합니다.
              </p>
            </div>
          </div>

          {/* 섹션 3: 3지점 측정 원칙 */}
          <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 space-y-1.5 text-xs">
            <h5 className="font-bold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#315C36] dark:text-[#34C759]" />
              현장 3지점 측정 원칙
            </h5>
            <p className="text-[#6E6E73] dark:text-[#8E8E93] leading-relaxed">
              더미의 편차를 줄이기 위해 동일 높이에서 좌·중·우 30cm 간격으로 3곳을 측정하여 평균값을 기록합니다.
            </p>
          </div>
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-black/5 dark:border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#315C36] text-white text-xs font-bold hover:bg-[#274b2c] active:scale-95 transition-all"
          >
            확인했습니다
          </button>
        </div>
      </div>
    </div>
  );
};
