import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileText,
  Presentation,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  Sparkles,
  AlertCircle,
  Share2,
} from 'lucide-react';
import type { ReportAudience, StandardAiSections } from '../../services/aiReport';
import type { StandardReportFacts, FarmReportData } from '../../services/reportData';
import { exportReportToGoogleDrive, type ExportImpact, type ExportTargetType } from '../../services/reportExport';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  audience: ReportAudience;
  facts?: StandardReportFacts;
  standardSections?: StandardAiSections;
  farmData?: FarmReportData;
  /** 대외 보고서의 탄소·톱밥 추정치 */
  impact?: ExportImpact;
  webhookUrl?: string;
  accessCode?: string;
}

export const ExportReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  audience,
  facts,
  standardSections,
  farmData,
  impact,
  webhookUrl = '',
  accessCode = '',
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportTargetType>('slides');
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultType, setResultType] = useState<ExportTargetType | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setLoading(true);
    setErrorMessage(null);
    setResultUrl(null);
    setResultType(null);

    const res = await exportReportToGoogleDrive({
      webhookUrl,
      accessCode,
      exportType: selectedFormat,
      audience,
      title,
      subtitle,
      facts,
      standardSections,
      farmData,
      impact,
    });

    setLoading(false);

    if (res.success && res.url) {
      setResultUrl(res.url);
      setResultType(selectedFormat);
    } else {
      setErrorMessage(res.error || '문서 생성에 실패했습니다. 최신 Apps Script(v23) 코드가 배포되었는지 확인해주세요.');
    }
  };

  const handleCopyUrl = async () => {
    if (!resultUrl) return;
    try {
      await navigator.clipboard.writeText(resultUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 실패 시 fallback
    }
  };

  const resetAndClose = () => {
    setLoading(false);
    setResultUrl(null);
    setErrorMessage(null);
    onClose();
  };

  // 화면 전환 효과(transform) 안에서는 fixed 창이 페이지 아래로 밀려나므로 body 에 그린다
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden text-[#1D1D1F] dark:text-[#F5F5F7]"
        onClick={e => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2D6A4F]/10 dark:bg-[#52B788]/20 flex items-center justify-center text-[#2D6A4F] dark:text-[#52B788]">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">리포트 내보내기 & 변환</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {audience === 'farm' ? '목장 내부용 현장 운영 일지' : '대외 보고용 월간 현황 보고서'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 본문 영역 */}
        <div className="p-5 space-y-4">
          {/* 성공 결과 화면 */}
          {resultUrl ? (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-[#E8F5E9] dark:bg-[#2D6A4F]/20 border border-[#2D6A4F]/30 text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#2D6A4F] text-white mx-auto shadow-md">
                  <Check className="w-6 h-6 stroke-[2.5]" />
                </div>
                <h3 className="text-base font-bold text-[#1B4332] dark:text-[#74C69D]">
                  {resultType === 'slides' ? 'Google Slides 생성 완료!' : 'Google Docs 생성 완료!'}
                </h3>
                <p className="text-xs text-[#2D6A4F] dark:text-[#A3E635] max-w-sm mx-auto leading-relaxed">
                  지소행 에코 그린 템플릿 서식이 적용된 문서가 Google Drive에 정상 생성되었습니다.
                </p>
              </div>

              {/* 액션 버튼들 */}
              <div className="space-y-2 pt-1">
                <a
                  href={resultUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                >
                  <span>새 탭에서 문서 열기</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-white/5 font-medium text-xs transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-semibold">링크가 복사되었습니다</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>문서 링크 주소 복사</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setResultUrl(null)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
                >
                  다른 형식으로 다시 내보내기
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 포맷 선택 카드 3종 */}
              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 px-0.5">
                  내보낼 형식 선택
                </label>

                {/* 1. Google Slides 카드 */}
                <div
                  onClick={() => !loading && setSelectedFormat('slides')}
                  className={`relative flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedFormat === 'slides'
                      ? 'border-[#2D6A4F] bg-[#F4FBF7] dark:bg-[#2D6A4F]/10 ring-1 ring-[#2D6A4F]'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-white/[0.02]'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-lg flex-shrink-0 ${
                      selectedFormat === 'slides'
                        ? 'bg-[#2D6A4F] text-white'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    <Presentation className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-bold text-gray-900 dark:text-white">
                        Google Slides (구글 슬라이드)
                      </strong>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        16:9 발표용
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                      에코 그린 테마가 적용된 4장의 슬라이드 덱 자동 생성 (표지, 빅 넘버 KPI, 세부 데이터 표, 액션 플랜)
                    </p>
                  </div>
                </div>

                {/* 2. Google Docs 카드 */}
                <div
                  onClick={() => !loading && setSelectedFormat('doc')}
                  className={`relative flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedFormat === 'doc'
                      ? 'border-[#2D6A4F] bg-[#F4FBF7] dark:bg-[#2D6A4F]/10 ring-1 ring-[#2D6A4F]'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-white/[0.02]'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-lg flex-shrink-0 ${
                      selectedFormat === 'doc'
                        ? 'bg-[#2D6A4F] text-white'
                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-bold text-gray-900 dark:text-white">
                        Google Docs (구글 문서)
                      </strong>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                        A4 공문서
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                      정돈된 표와 메타정보가 포함된 A4 공식 보고서 문서 자동 생성 (내용 수정 및 Word 다운로드 용이)
                    </p>
                  </div>
                </div>

              </div>

              {/* 에러 메시지 알림 */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold block mb-0.5">내보내기 실패</strong>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* 로딩 안내 */}
              {loading && (
                <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-200 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  <span>
                    Google Apps Script와 통신하여 슬라이드/문서를 서식에 맞춰 생성하고 있습니다 (약 2~4초 소요)...
                  </span>
                </div>
              )}

              {/* 하단 실행 버튼 */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetAndClose}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleStartExport}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#2D6A4F] hover:bg-[#1B4332] text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>생성 중...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {selectedFormat === 'slides' ? '구글 슬라이드로 생성 ↗' : '구글 문서로 생성 ↗'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
