import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { COMPOST_GAS_API_URL } from '../constants/defaultData';
import {
  checkAccessCode,
  clearAccess,
  getAccessCode,
  readCachedAccess,
  saveAccess,
  takeCodeFromUrl,
  type AccessInfo,
} from '../services/accessCode';

type AccessStatus = 'checking' | 'ready' | 'locked';

interface AccessContextValue {
  status: AccessStatus;
  info: AccessInfo | null;
  /** 코드 입력 화면에 보여 줄 안내 */
  message: string | null;
  isManager: boolean;
  /** 목장 매니저의 목장 (관리자면 null) */
  managerRanch: string | null;
  submitCode: (code: string) => Promise<boolean>;
  signOut: () => void;
  /** 서버가 권한 없음이라고 답했을 때 — 코드를 다시 확인한다 */
  recheck: () => void;
}

const AccessContext = createContext<AccessContextValue | null>(null);

export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [urlCode] = useState(() => takeCodeFromUrl());
  const [info, setInfo] = useState<AccessInfo | null>(() => (urlCode ? null : readCachedAccess()));
  const [status, setStatus] = useState<AccessStatus>(() => (urlCode || !readCachedAccess() ? 'checking' : 'ready'));
  const [message, setMessage] = useState<string | null>(null);
  const checkingRef = useRef(false);

  const verify = useCallback(async (code: string, fromUser: boolean): Promise<boolean> => {
    const result = await checkAccessCode(COMPOST_GAS_API_URL, code);
    if (result.kind === 'ok') {
      saveAccess(code, result.info);
      setInfo(result.info);
      setMessage(null);
      setStatus('ready');
      return true;
    }
    if (result.kind === 'denied') {
      clearAccess();
      setInfo(null);
      // 처음 열었을 때 코드가 없어서 막힌 것이면 안내만 조용히
      setMessage(fromUser || code ? result.message : null);
      setStatus('locked');
      return false;
    }
    // 인터넷이 안 되면 마지막으로 확인된 권한으로 이어서 쓴다
    const cached = readCachedAccess();
    if (cached && !fromUser) {
      setInfo(cached);
      setStatus('ready');
      return true;
    }
    setMessage(result.message);
    setStatus('locked');
    return false;
  }, []);

  // 앱을 열 때 한 번 확인 (보관한 권한이 있으면 먼저 화면을 열고 뒤에서 확인)
  useEffect(() => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    void verify(urlCode ?? getAccessCode(), Boolean(urlCode));
  }, [urlCode, verify]);

  const submitCode = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) {
        setMessage('접속 코드를 입력해주세요.');
        return false;
      }
      return verify(trimmed, true);
    },
    [verify]
  );

  const signOut = useCallback(() => {
    clearAccess();
    setInfo(null);
    setMessage(null);
    setStatus('locked');
  }, []);

  // 탭 제목 — 직원용과 목장 매니저용을 브라우저 탭에서 바로 구분할 수 있게
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title =
      status !== 'ready' || !info
        ? 'C.TRACK · 커피박 자원순환'
        : info.role === 'manager'
          ? `${info.ranch} 현장점검 · C.TRACK`
          : 'C.TRACK · 직원용';
  }, [status, info]);

  const recheck = useCallback(() => {
    void verify(getAccessCode(), false);
  }, [verify]);

  const value = useMemo<AccessContextValue>(
    () => ({
      status,
      info,
      message,
      isManager: info?.role === 'manager',
      managerRanch: info?.role === 'manager' ? info.ranch ?? null : null,
      submitCode,
      signOut,
      recheck,
    }),
    [status, info, message, submitCode, signOut, recheck]
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
};

export function useAccess(): AccessContextValue {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error('useAccess must be used within AccessProvider');
  return ctx;
}
