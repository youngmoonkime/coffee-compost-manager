/**
 * 구글 문서(Docs) 및 구글 슬라이드(Slides) 내보내기 서비스
 * Google Apps Script Web App의 export_google_doc, export_google_slides 엔드포인트를 호출합니다.
 */

import type { ReportAudience, StandardAiSections } from './aiReport';
import type { StandardReportFacts, FarmReportData } from './reportData';
import { getAccessCode } from './accessCode';
import { hasMeasurement } from '../utils/calculations';
import { MOLD_LABELS, describeWorkType } from '../utils/fieldOps';
import { COFFEE_GROUNDS_INCINERATION_CO2_PER_KG } from '../constants/impactFactors';

export type ExportTargetType = 'doc' | 'slides';

/** 대외 보고서에 싣는 임팩트 추정치 — 수거 & 임팩트 화면과 같은 계산 */
export interface ExportImpact {
  /** 소각 배출 회피 참고 추정 (kgCO₂) */
  co2AvoidedKg: number;
  /** 톱밥 구매비 절감 추정 (원). 월 톱밥 소요량이 없으면 null */
  sawdustSavingKrw: number | null;
}

export function impactForExport(collectedKg: number, sawdustSavingKrw: number | null): ExportImpact {
  return {
    co2AvoidedKg: Math.round(Math.max(0, collectedKg) * COFFEE_GROUNDS_INCINERATION_CO2_PER_KG),
    sawdustSavingKrw,
  };
}

/**
 * 문서에 찍을 목장 보고서 — 최근 기록은 글자로 바꿔 보낸다.
 * 재지 않은 온도·함수율(0)은 빈 값으로, 곰팡이·혼합은 사람이 읽는 말로 바꾼다.
 */
function farmDataForExport(farmData: FarmReportData) {
  return {
    ...farmData,
    recentRecords: farmData.recentRecords.map(r => {
      const measured = hasMeasurement(r);
      return {
        date: r.date,
        workType: describeWorkType(r),
        coreTemp: measured && r.coreTemp > 0 ? r.coreTemp : null,
        moisture: measured && r.moisture > 0 ? r.moisture : null,
        mixedLabel: r.mixed === undefined ? '기록 없음' : r.mixed ? '혼합함' : '혼합 안 함',
        moldLabel: r.moldStatus ? MOLD_LABELS[r.moldStatus] : '기록 없음',
      };
    }),
  };
}

export interface ExportReportPayload {
  webhookUrl: string;
  accessCode?: string;
  exportType: ExportTargetType;
  audience: ReportAudience;
  title: string;
  subtitle?: string;
  facts?: StandardReportFacts;
  standardSections?: StandardAiSections;
  farmData?: FarmReportData;
  impact?: ExportImpact;
}

export interface ExportReportResponse {
  success: boolean;
  url?: string;
  fileId?: string;
  title?: string;
  exportType?: ExportTargetType;
  error?: string;
  message?: string;
}

/**
 * 보고서 데이터를 Google Docs 또는 Google Slides로 내보내기 요청
 */
export async function exportReportToGoogleDrive(
  payload: ExportReportPayload
): Promise<ExportReportResponse> {
  const { webhookUrl, accessCode, exportType, audience, title, subtitle, facts, standardSections, farmData, impact } = payload;

  if (!webhookUrl || !webhookUrl.trim()) {
    return {
      success: false,
      error: '구글 스프레드시트 Web App URL이 설정되지 않았습니다. [환경설정]에서 연동 주소를 확인해주세요.',
    };
  }

  const eventType = exportType === 'slides' ? 'export_google_slides' : 'export_google_doc';

  const bodyData = {
    eventType,
    accessCode: accessCode || getAccessCode() || '',
    audience,
    title,
    subtitle: subtitle || '',
    facts: facts || null,
    standardSections: standardSections || null,
    farmData: farmData ? farmDataForExport(farmData) : null,
    impact: impact || null,
    exportedAt: new Date().toISOString(),
  };

  try {
    const response = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(bodyData),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `서버 응답 오류 (HTTP ${response.status})`,
      };
    }

    const text = await response.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        success: false,
        error: '서버가 올바른 JSON으로 응답하지 않았습니다. Apps Script 최신 코드가 배포되었는지 확인해주세요.',
      };
    }

    if (json.status === 'error' || json.code === 'forbidden') {
      return {
        success: false,
        error: String(json.message || '문서 생성 중 오류가 발생했습니다.'),
      };
    }

    if (json.status === 'success' && json.url) {
      return {
        success: true,
        url: String(json.url),
        fileId: json.fileId ? String(json.fileId) : undefined,
        title: json.title ? String(json.title) : title,
        exportType,
        message: String(json.message || '문서가 성공적으로 생성되었습니다.'),
      };
    }

    return {
      success: false,
      error: String(json.message || '문서 생성 결과를 확인할 수 없습니다.'),
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `통신 실패: ${errMsg}. 네트워크 또는 Apps Script 배포 상태를 점검해주세요.`,
    };
  }
}
