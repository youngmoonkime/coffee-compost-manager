import React from 'react';
import { X, ShieldCheck } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/8 dark:border-white/12 shadow-2xl overflow-hidden text-[#1D1D1F] dark:text-[#F5F5F7] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
      >
        {/* 상단 닫기 */}
        <div className="flex justify-end p-4 pb-0">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/20 active:scale-95 transition-all"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 로고 & 타이틀 */}
        <div className="px-6 pb-6 text-center space-y-3">
          <div className="flex justify-center">
            <img
              src="/logo.png"
              alt="로고"
              className="w-16 h-16 object-contain drop-shadow-sm"
            />
          </div>
          <div>
            <h3 id="about-modal-title" className="text-xl font-bold tracking-tight">
              C.TRACK
            </h3>
            <p className="text-[13px] font-semibold text-[#315C36] dark:text-[#34C759] mt-0.5">
              커피박 자원순환 시스템
            </p>
            <p className="text-[11px] text-[#8E8E93] mt-1">
              Coffee Traceability, Resource &amp; Asset Control Kit
            </p>
            <p className="text-xs text-[#8E8E93] mt-1.5">
              건준목장 x 지구를 지키는 소소한 행동
            </p>
          </div>

          <div className="py-2 inline-flex items-center gap-1 px-3 rounded-full bg-[#315C36]/10 text-[#315C36] dark:text-[#34C759] text-xs font-bold">
            v1.0 (2026.09)
          </div>

          <p className="text-xs text-[#6E6E73] dark:text-[#8E8E93] leading-relaxed break-keep px-2">
            커피박을 고품질 가축 깔개로 재자원화하여 목장 악취 저감과 톱밥 구입비 절감을 돕는 스마트 현장 관리 시스템입니다.
          </p>

          <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/10 text-[11px] text-[#8E8E93] space-y-1">
            <div className="flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#315C36] dark:text-[#34C759]" />
              오프라인 큐 및 Google Sheets 동기화 지원
            </div>
            <p>© 2026 GunJun Ranch. All rights reserved.</p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-black/5 dark:bg-white/10 text-xs font-bold hover:bg-black/10 dark:hover:bg-white/20 active:scale-[0.98] transition-all"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
