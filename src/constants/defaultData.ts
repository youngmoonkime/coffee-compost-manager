import type { CompostSettings } from '../types';

export const DEFAULT_SETTINGS: CompostSettings = {
  usableMoistureMin: 30,
  usableMoistureMax: 40,
  highMoistureThreshold: 65,
  highTempThreshold: 65,
  coreProbeDepthCm: 15,
};

/** 기록할 때 기본으로 잡히는 목장 */
export const DEFAULT_RANCH_NAME = '건준목장';

/**
 * 기록을 저장하는 구글 시트("커피박 부숙 관리 대장")의 Apps Script 웹 앱 주소.
 * 앱에 고정한다 — 기기마다 따로 입력하다 틀리거나 다른 시트에 기록되는 일을 막는다.
 * 스크립트를 고칠 때는 [배포 관리 → 연필 → 새 버전]으로 배포해야 이 주소가 유지된다.
 */
export const SHEET_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbyRqCQpht0Nu49Dwb-PmWnM6UtozDzn_ZYN1iH0puu3CWj7DhRY8rbsElWP1RZn1H6b/exec';
