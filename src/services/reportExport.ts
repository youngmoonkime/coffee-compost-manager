import type { MoldStatus, TrendDirection } from '../types';
import { MOISTURE_TREND_LABELS, MOLD_LABELS } from '../utils/fieldOps';
import { AUDIENCE_LABELS, type ReportAudience, type ReportSections } from './aiReport';
import type { ImpactFacts } from './reportData';

/**
 * 리포트 한 장의 구성 — 화면(인쇄·PDF 포함)에 쓰는 내용을 여기서 한 번만 만든다.
 * 독자마다 구성이 다르다.
 * - 목장 내부용: 현장 표 → 현장 정리 → 장소별 현황
 * - 대외 보고용: 보고 내용 → 자원화 현황 (현장 세부 제외)
 */

export interface SavedReportLike {
  audience: ReportAudience;
  createdAt: string;
  facts: ImpactFacts;
  sections: ReportSections;
}

export interface ReportMetric {
  label: string;
  value: string;
  note: string;
}

export interface ReportTable {
  heading: string;
  /** 첫 줄을 머리글로 쓰는 표면 true */
  headerRow?: boolean;
  rows: string[][];
  note?: string;
}

export interface ReportStory {
  heading: string;
  parts: { heading: string; text: string }[];
  actionsHeading: string;
  actions: string[];
}

export interface ReportContent {
  eyebrow: string;
  title: string;
  meta: string;
  metrics: ReportMetric[];
  /** 순서대로 보여 줄 블록 */
  blocks: ({ kind: 'story'; story: ReportStory } | { kind: 'table'; table: ReportTable } | { kind: 'charts' })[];
  basis: string[];
  warnings: string[];
}

const STORY_TITLES: Record<ReportAudience, { head: string; summary: string; meaning: string; next: string; actions: string }> = {
  farm: {
    head: '현장 정리',
    summary: '이번 달 현장 상황',
    meaning: '관리 포인트',
    next: '다음 방문 때 할 일',
    actions: '현장 작업 체크리스트',
  },
  official: {
    head: '보고 내용',
    summary: '1. 추진 실적',
    meaning: '2. 성과와 의의',
    next: '3. 향후 계획',
    actions: '향후 추진 과제',
  },
};

export function formatKg(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })} t`;
  return `${Math.round(kg).toLocaleString('ko-KR')} kg`;
}

function formatWon(won: number): string {
  if (won >= 10000) return `${Math.round(won / 10000).toLocaleString('ko-KR')}만원`;
  return `${Math.round(won).toLocaleString('ko-KR')}원`;
}

export function formatMoment(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** 절감 추정 설명 — 예전 저장본(단가 한 개·m³ 기준)도 읽히도록 없는 값은 건너뛴다 */
function savingsNote(savings: NonNullable<ImpactFacts['savings']>): string {
  const tons = savings.basisTons ?? savings.basisKg / 1000;
  const tonText = `${tons.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}톤`;
  const byRanch = savings.byRanch ?? [];
  if (byRanch.length === 1) {
    return `${tonText} × ${byRanch[0].pricePerTon.toLocaleString('ko-KR')}원/톤 (추정)`;
  }
  if (byRanch.length > 1) return `${tonText} · 목장 ${byRanch.length}곳 단가 적용 (추정)`;
  return `${tonText} 분량 (추정)`;
}

export function buildReportContent(report: SavedReportLike): ReportContent {
  const { facts, sections, audience } = report;
  const { collection, compost, field, savings, period } = facts;
  const official = audience === 'official';
  const titles = STORY_TITLES[audience];

  const collectedKg = collection?.totalKg ?? compost.monthCollectedKg;
  const pileText = field
    ? `${field.currentPileKg.toLocaleString('ko-KR')}kg${
        field.targetPileKg
          ? ` / 목표 ${field.targetPileKg.toLocaleString('ko-KR')}kg (${field.progressPercent}%)`
          : ' (목표량 미설정)'
      }`
    : '—';

  const metrics: ReportMetric[] = official
    ? [
        {
          label: '커피박 수거량',
          value: formatKg(collectedKg),
          note: collection ? `매장 ${collection.activeStoreCount}곳에서 수거` : '현장 하역 기록 기준',
        },
        {
          label: '전월 대비',
          value:
            collection?.changePercent != null
              ? `${collection.changePercent > 0 ? '+' : ''}${collection.changePercent}%`
              : '—',
          note: collection?.previousMonthKg != null ? `전월 ${formatKg(collection.previousMonthKg)}` : '비교 자료 없음',
        },
        {
          label: '톱밥 대체 절감 추정',
          value: savings ? formatWon(savings.sawdustCostKrw) : '—',
          note: savings ? savingsNote(savings) : '수거량 자료 없음',
        },
      ]
    : [
        {
          label: '현재 추정 더미량',
          value: field ? formatKg(field.currentPileKg) : '—',
          note: field?.targetPileKg ? `목표 ${formatKg(field.targetPileKg)} 중 ${field.progressPercent}%` : '목표량 미설정',
        },
        { label: '깔개 사용 판단', value: field?.beddingStatusLabel ?? '—', note: '현장 기록으로 계산' },
        {
          label: '이번 달 신규 투입',
          value: formatKg(compost.monthCollectedKg),
          note: `기록 ${compost.monthRecordCount}건`,
        },
      ];

  const story: ReportStory = {
    heading: titles.head,
    parts: [
      { heading: titles.summary, text: sections.summary },
      { heading: titles.meaning, text: sections.meaning },
      { heading: titles.next, text: sections.recommendation },
    ],
    actionsHeading: titles.actions,
    actions: sections.actions,
  };

  const statusTable: ReportTable | null = !field
    ? null
    : official
      ? {
          heading: `자원화 현황 · ${field.ranchName}`,
          rows: [
            ['참여 목장', compost.ranchNames.join(', ') || '—'],
            ['부숙 중인 커피박', pileText],
            ['깔개 활용량', `${field.beddingUsedKg.toLocaleString('ko-KR')}kg`],
            [
              '운영 현황',
              `${field.cycleDays !== null ? `운영 ${field.cycleDays}일째 · ` : ''}현장 방문 ${field.visitCount}회 · ${field.beddingStatusLabel}`,
            ],
          ],
        }
      : {
          heading: `현장 운영 현황 · ${field.ranchName}${field.cycleId ? ` (${field.cycleId})` : ''}`,
          rows: [
            ['현재 추정 더미량', pileText],
            [
              '함수율 · 심부 온도',
              `${field.currentMoisture ?? '—'}% (${
                MOISTURE_TREND_LABELS[field.moistureTrend as TrendDirection] ?? '자료 부족'
              }) · ${field.currentCoreTemp ?? '—'}℃`,
            ],
            [
              '혼합 · 곰팡이',
              `최근 7일 ${field.mixingCountLast7Days}회 · ${
                field.moldStatus === 'unknown' ? '곰팡이 기록 없음' : `곰팡이 ${MOLD_LABELS[field.moldStatus as MoldStatus]}`
              }`,
            ],
            ['깔개 사용 판단', `${field.beddingStatusLabel} — ${field.beddingStatusReason}`],
          ],
          note: field.note,
        };

  const pileTable: ReportTable | null =
    !official && compost.piles.length > 0
      ? {
          heading: '장소별 부숙 현황',
          headerRow: true,
          rows: [
            ['장소', '최근 측정', '함수율', '심부 온도', '판정'],
            ...compost.piles.map(pile => [
              `${pile.location} (${pile.ranchName})`,
              pile.latestDate.slice(5).replace('-', '/'),
              `${pile.moisture}%`,
              `${pile.coreTemp}℃`,
              pile.verdict,
            ]),
          ],
        }
      : null;

  // 대외용: 목장별 톱밥 대체 추정 (목장마다 톱밥 단가가 다르다)
  const savingsTable: ReportTable | null =
    official && savings?.byRanch?.length
      ? {
          heading: '목장별 톱밥 대체 추정',
          headerRow: true,
          rows: [
            ['목장', '물량', '톱밥 단가', '추정액'],
            ...savings.byRanch.map(item => [
              item.ranchName,
              `${item.tons.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}톤`,
              `${item.pricePerTon.toLocaleString('ko-KR')}원/톤${item.priceSource === 'default' ? ' (기본)' : ''}`,
              formatWon(item.costKrw),
            ]),
          ],
          note: savings.basisLabel,
        }
      : null;

  const blocks: ReportContent['blocks'] = [];
  const pushTable = (table: ReportTable | null) => {
    if (table) blocks.push({ kind: 'table', table });
  };
  if (official) {
    blocks.push({ kind: 'story', story });
    pushTable(statusTable);
    pushTable(savingsTable);
    if (collection) blocks.push({ kind: 'charts' });
  } else {
    pushTable(statusTable);
    blocks.push({ kind: 'story', story });
    pushTable(pileTable);
  }

  const basis = [...facts.sources, '숫자는 모두 기록에서 직접 계산했고, 해설 문장은 AI 가 작성했습니다.'];
  if (official) basis.push('절감액은 같은 무게의 톱밥을 목장별 구매 단가로 대신 산다고 볼 때의 추정입니다. 운송·처리비는 빠져 있습니다.');
  if (collection?.isPartialMonth) basis.push('이번 달은 아직 진행 중이라 수거량이 최종 실적이 아닙니다.');

  return {
    eyebrow: `${official ? '커피박 자원순환 사업 실적 보고' : '목장 현장 관리 리포트'} · ${AUDIENCE_LABELS[audience]}`,
    title: sections.headline,
    meta: `${period.label} · ${compost.ranchNames.join(', ') || '목장 미등록'} · ${formatMoment(report.createdAt)} 작성`,
    metrics,
    blocks,
    basis,
    warnings: facts.dataWarnings,
  };
}
