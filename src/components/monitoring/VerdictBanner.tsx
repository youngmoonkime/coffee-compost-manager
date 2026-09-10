import React, { useState } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { useToast } from '../../contexts/ToastContext';
import type { VerdictInfo } from '../../types';

interface VerdictBannerProps {
  currentVerdict: VerdictInfo;
}

export const VerdictBanner: React.FC<VerdictBannerProps> = ({ currentVerdict }) => {
  const { settings, activeBatch, completeBatch } = useCompost();
  const { showToast } = useToast();
  const [showCriteria, setShowCriteria] = useState(false);

  const handleCompleteBatch = () => {
    if (!activeBatch) return;
    completeBatch(activeBatch.id);
    showToast('배치가 완숙 완료 처리되었습니다', `${activeBatch.code} 축사 깔짚 투입 완료`);
  };

  // 배치가 하나도 없으면 판정할 대상이 없다. 기본값으로 만들어낸 판정을
  // 보여주면 실제 계측 결과처럼 오해된다.
  if (!activeBatch) {
    return (
      <section className="w-full mb-3">
        <div className="rounded-2xl p-4 bg-surface-container-low border border-outline-variant/30 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px] text-outline">eco</span>
          </div>
          <div className="min-w-0">
            <span className="font-headline-sm text-[15px] font-bold text-on-surface block">
              판정할 배치가 없습니다
            </span>
            <span className="font-caption text-[11.5px] text-on-surface-variant block mt-0.5 leading-relaxed">
              위의 [새 하역 등록]으로 커피박 배치를 먼저 만들어주세요.
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full mb-3">
      <div className={`${currentVerdict.bannerClass} rounded-2xl p-4 shadow-md transition-all duration-300 relative overflow-hidden`}>
        {/* 배경 은은한 아이콘 */}
        <div className="absolute -right-3 -bottom-3 opacity-10 pointer-events-none text-white">
          <span className="material-symbols-outlined text-[90px]">eco</span>
        </div>

        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-surface-container-lowest/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
              <span className={`material-symbols-outlined text-[26px] ${currentVerdict.iconClass}`}>
                {currentVerdict.icon}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-caption text-[11px] uppercase tracking-wider font-semibold whitespace-nowrap opacity-90">
                  실시간 자동 판정
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80"></span>
              </div>
              <h2 className={`font-headline-lg text-headline-lg leading-tight mt-0.5 ${currentVerdict.titleClass}`}>
                {currentVerdict.title}
              </h2>
            </div>
          </div>

          <button
            onClick={() => setShowCriteria(prev => !prev)}
            aria-label="판정 기준 도움말"
            className="p-1 rounded-full opacity-80 hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">help_outline</span>
          </button>
        </div>

        <p className="font-body-sm text-[12px] opacity-90 mt-2 leading-relaxed relative z-10 whitespace-normal break-keep">
          {currentVerdict.subtitle}
        </p>

        {/* 완숙 완료 상태일 때 원클릭 완료 버튼 제공 */}
        {currentVerdict.type === 'ready' && activeBatch?.status === 'fermenting' && (
          <div className="mt-3 pt-2.5 border-t border-primary/20 relative z-10">
            <button
              onClick={handleCompleteBatch}
              className="w-full py-2 bg-primary text-on-primary rounded-xl font-label-md text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>완숙 확정 및 축사 깔짚 투입 승인</span>
            </button>
          </div>
        )}

        {/* 기준 안내 도움말 토글 박스 */}
        {showCriteria && (
          <div className="mt-2.5 pt-2.5 border-t border-current/15 text-caption font-body-sm relative z-10 animate-in fade-in duration-200">
            <div className="flex items-start gap-2 bg-black/15 p-2.5 rounded-xl text-[11px] leading-snug break-keep backdrop-blur-sm">
              <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">info</span>
              <div>
                <span className="font-bold block mb-0.5">완숙 투입 가능 적합 기준:</span>
                <span>
                  심부 함수율 <strong>{settings.targetMoistureThreshold}% 이하</strong> 도달 시 축사 깔짚 투입 승인 (심부온도 <strong>{settings.highTempThreshold}℃ 초과</strong> 또는 함수율 <strong>{settings.highMoistureThreshold}% 초과</strong> 시 교반 필요)
                </span>
                <span className="block mt-1 text-[10px] opacity-80">
                  * 함수율 {settings.highMoistureThreshold}% 초과 또는 심부온도 {settings.highTempThreshold}℃ 초과 시 과열/과습으로 교반(뒤집기) 필요
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
