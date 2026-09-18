import React, { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { useAccess } from '../../contexts/AccessContext';

/**
 * 접속 코드를 확인하기 전에는 앱을 열지 않는다.
 * 회사 관리자 코드 → 전체 기능, 목장 매니저 코드 → 그 목장의 현장점검·현황만.
 */
export const AccessGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, message, submitCode } = useAccess();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'ready') return <>{children}</>;

  if (status === 'checking') {
    return (
      <div className="min-h-full h-full flex items-center justify-center bg-[#F5F5F7] dark:bg-black">
        <div className="flex items-center gap-2 text-sm text-[#6E6E73] dark:text-[#8E8E93]">
          <Loader2 className="w-4 h-4 animate-spin" />
          접속 권한을 확인하는 중입니다
        </div>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await submitCode(code);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full h-full flex items-center justify-center px-4 bg-[#F5F5F7] dark:bg-black">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 shadow-sm p-6 space-y-4"
      >
        <div className="flex flex-col items-center text-center gap-2">
          <img src="/logo.png" alt="" className="w-12 h-12 object-contain" />
          <h1 className="text-lg font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">C.TRACK</h1>
          <p className="text-[12px] font-semibold text-[#315C36] dark:text-[#34C759] -mt-1">커피박 자원순환 시스템</p>
          <p className="text-[13px] text-[#6E6E73] dark:text-[#8E8E93] break-keep">
            회사 또는 목장에서 받은 접속 코드를 입력해주세요.
          </p>
        </div>

        <label className="block">
          <span className="sr-only">접속 코드</span>
          <div className="relative">
            <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8E93]" aria-hidden="true" />
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={code}
              onChange={event => setCode(event.target.value)}
              placeholder="접속 코드"
              className="w-full h-12 pl-10 pr-3 rounded-xl bg-[#F2F2F7] dark:bg-[#2C2C2E] text-base text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/5 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#315C36]/40"
            />
          </div>
        </label>

        {message && (
          <p role="alert" className="text-[13px] text-[#C5221F] dark:text-[#FF6961] break-keep">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="w-full h-12 rounded-xl bg-[#315C36] dark:bg-[#34C759] text-white dark:text-black text-[15px] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {busy ? '확인 중' : '들어가기'}
        </button>
      </form>
    </div>
  );
};
