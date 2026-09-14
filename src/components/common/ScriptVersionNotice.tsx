import React from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { REQUIRED_SCRIPT_VERSION } from '../../services/googleSheetsService';

/**
 * 시트에 배포된 Apps Script 가 앱보다 옛 버전이면 알린다.
 * 코드를 붙여넣고도 [새 버전]으로 배포하지 않으면 예전 코드가 계속 돌아가는데,
 * 시트만 봐서는 알 수 없어 "바뀐 게 없다"로만 보인다.
 */
export const ScriptVersionNotice: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { googleConfig, setIsGoogleModalOpen } = useCompost();
  const version = googleConfig.scriptVersion;

  if (!googleConfig.sheetWebhookUrl || version === undefined || version >= REQUIRED_SCRIPT_VERSION) return null;

  return (
    <div className={`rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-amber-900 flex items-start gap-2 ${className}`}>
      <span className="material-symbols-outlined text-[18px] shrink-0">update</span>
      <div className="min-w-0 font-caption text-[12px] leading-relaxed break-keep">
        <strong className="block">
          시트에서 돌아가는 스크립트가 v{version}입니다 (최신 v{REQUIRED_SCRIPT_VERSION})
        </strong>
        최신 기능과 보안 수정을 적용하려면 [코드 복사] 후 붙여넣고 [배포 관리 → 연필 → 버전: 새 버전]으로 배포해주세요.
        <button
          type="button"
          onClick={() => setIsGoogleModalOpen(true)}
          className="mt-1 block font-bold underline"
        >
          재배포 방법 보기
        </button>
      </div>
    </div>
  );
};
