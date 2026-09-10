import type { BatchStatus, CompostSettings, VerdictInfo } from '../types';

/**
 * 심부온도, 외기온도, 함수율 및 기준치 설정을 바탕으로 실시간 부숙 판정을 수행합니다.
 */
export function evaluateFermentation(
  coreTemp: number,
  moisture: number,
  settings: CompostSettings
): VerdictInfo {
  // 1. 개입 필요 (과열 또는 과습): 함수율 > 65% OR 심부온도 > 65℃
  //    과열은 함수율이 낮아도 우선 조치해야 하므로 완숙 판정보다 먼저 본다.
  if (moisture > settings.highMoistureThreshold || coreTemp > settings.highTempThreshold) {
    return {
      type: 'action_needed',
      title: '개입 필요 (교반 요망)',
      subtitle: '과열/과습 상태 감지: 뒤집기(호기성 교반) 권장',
      icon: 'warning',
      badgeText: '교반필요',
      bannerClass: 'bg-error-container text-on-error-container border border-error/20',
      titleClass: 'text-error font-bold',
      iconClass: 'text-error',
    };
  }

  // 2. 완숙 투입 가능: 심부 함수율이 기준 이하
  //    (예전에는 외기-심부 온도차도 조건이었으나, 심부온도는 외기와 비교하는 값이 아니라
  //     같은 더미를 기간을 두고 재측정해 추이로 보는 값이라 판정에서 제외했다)
  if (moisture <= settings.targetMoistureThreshold) {
    return {
      type: 'ready',
      title: '완숙 투입 가능',
      subtitle: '축사 깔짚 투입 기준 적합 (부숙 완료)',
      icon: 'task_alt',
      badgeText: '완숙적합',
      bannerClass: 'bg-primary-fixed text-on-primary-fixed border border-primary/20',
      titleClass: 'text-primary font-bold',
      iconClass: 'text-primary',
    };
  }

  // 3. 부숙 지속 (정상 발열 및 호기성 분해 진행 중)
  return {
    type: 'ongoing',
    title: '부숙 진행 중',
    subtitle: '호기성 미생물 활성화 및 발열 분해 지속',
    icon: 'heat_pump',
    badgeText: '부숙지속',
    bannerClass: 'bg-primary-container text-on-primary',
    titleClass: 'text-white font-bold',
    iconClass: 'text-primary-fixed-dim',
  };
}

/**
 * 현장 기준 시간대. 구글 시트(Apps Script)도 같은 시간대를 쓰므로
 * 기기 설정과 무관하게 항상 한국 시각으로 기록되도록 고정한다.
 */
export const FIELD_TIME_ZONE = 'Asia/Seoul';

type DateTimeParts = { year: string; month: string; day: string; hour: string; minute: string };

/** 지정 시각을 한국 시간대 기준의 연/월/일/시/분으로 분해 */
function getFieldParts(date: Date = new Date()): DateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FIELD_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23', // hour12:false 는 자정을 24시로 주는 환경이 있어 h23 을 명시
  }).formatToParts(date);

  const pick = (type: string) => parts.find(p => p.type === type)?.value ?? '00';

  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
  };
}

/** 'YYYY-MM-DD' 를 시간대 영향 없이 비교할 수 있는 일(day) 수치로 변환 */
function toDayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000);
}

/**
 * 시작일로부터 오늘까지의 경과일수(D+N)를 계산합니다.
 * 하역 당일이 D+1 이고, 하루가 지날 때마다 1씩 증가합니다.
 */
export function calculateDaysElapsed(startDateStr: string): number {
  if (!startDateStr) return 1;

  const diffDays = toDayIndex(getCurrentDateString()) - toDayIndex(startDateStr);
  return Math.max(1, diffDays + 1);
}

/**
 * 신규 배치 번호 생성 (예: GJ-260821-01)
 */
export function generateBatchCode(ranchCode: string = 'GJ'): string {
  const { year, month, day } = getFieldParts();
  const randomSeq = String(Math.floor(Math.random() * 90) + 10);
  return `${ranchCode}-${year.slice(-2)}${month}${day}-${randomSeq}`;
}

/** 두 날짜(YYYY-MM-DD) 사이의 일수. 같은 날이면 1일차. */
export function daysBetweenInclusive(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 1;
  return Math.max(1, toDayIndex(endDateStr) - toDayIndex(startDateStr) + 1);
}

export interface BatchPeriod {
  /** 부숙 일수 (진행 중이면 오늘까지, 완료면 완료일까지) */
  days: number;
  /** 아직 부숙 진행 중인지 */
  isOngoing: boolean;
  /** 기간의 끝 날짜 (진행 중이면 오늘) */
  endDate: string;
}

/**
 * 배치의 부숙 기간.
 * 완료된 배치는 완료일에서 멈춰야 한다. 오늘 기준으로 계속 세면
 * 한 달 전에 끝난 배치가 'D+41일차'처럼 표시돼 맥락이 깨진다.
 */
export function getBatchPeriod(batch: {
  startDate: string;
  completedDate?: string;
  status: BatchStatus;
}): BatchPeriod {
  const isOngoing = batch.status !== 'completed';
  const endDate = isOngoing ? getCurrentDateString() : batch.completedDate || getCurrentDateString();

  return {
    days: daysBetweenInclusive(batch.startDate, endDate),
    isOngoing,
    endDate,
  };
}

/**
 * 화면 상단에 표시할 목장 이름.
 * 본장은 수식어를 떼고 '건준목장'만 보여주고, 제2축사처럼 구분이 필요한 곳은 그대로 둔다.
 */
export function getRanchDisplayName(ranchName?: string): string {
  if (!ranchName) return '목장 미지정';
  return ranchName.replace(' (본장)', '').trim();
}

/**
 * 현재 시간 문자열 (HH:mm) — 한국 시간 기준
 */
export function getCurrentTimeString(): string {
  const { hour, minute } = getFieldParts();
  return `${hour}:${minute}`;
}

/**
 * 현재 날짜 문자열 (YYYY-MM-DD) — 한국 시간 기준.
 * 이전에는 toISOString() 을 써서 UTC 날짜가 나갔고, 자정~오전 9시 사이에는
 * 구글 시트에 하루 전 날짜가 기록됐다.
 */
export function getCurrentDateString(): string {
  const { year, month, day } = getFieldParts();
  return `${year}-${month}-${day}`;
}

/** 구글 시트에 기록할 'YYYY-MM-DD HH:mm' (한국 시간) */
export function getCurrentDateTimeString(): string {
  return `${getCurrentDateString()} ${getCurrentTimeString()}`;
}
