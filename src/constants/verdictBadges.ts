import type { VerdictType } from '../types';

/** 목록·카드에 쓰는 짧은 판정 배지 */
export const VERDICT_BADGES: Record<VerdictType, { text: string; className: string }> = {
  first: { text: '첫 기록', className: 'bg-surface-container-high text-on-surface-variant' },
  drying: { text: '부숙중', className: 'bg-secondary-container text-on-secondary-container' },
  usable: { text: '사용후보', className: 'bg-primary-fixed text-on-primary-fixed' },
  too_dry: { text: '건조', className: 'bg-surface-container-high text-on-surface' },
  action_needed: { text: '혼합필요', className: 'bg-error-container text-on-error-container' },
};
