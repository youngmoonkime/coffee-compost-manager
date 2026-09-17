import React, { useState } from 'react';
import {
  ArrowLeft,
  Printer,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Award,
} from 'lucide-react';
import type { ReportAudience, ReportSections, StandardAiSections } from '../../services/aiReport';
import { generateFallbackAiSections } from '../../services/aiReport';
import type { ImpactFacts, StandardReportFacts } from '../../services/reportData';
import { buildStandardReportFacts } from '../../services/reportData';

export interface SavedReport {
  id: string;
  createdAt: string;
  audience: ReportAudience;
  model?: string;
  facts: ImpactFacts;
  factsKey?: string;
  sections: ReportSections;
  standardSections?: StandardAiSections;
}

interface Props {
  report: SavedReport;
  onBack: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
  reused?: boolean;
  regenerateError?: string | null;
}

export const ImpactReportView: React.FC<Props> = ({
  report,
  onBack,
  onRegenerate,
  regenerating,
  reused = false,
  regenerateError = null,
}) => {
  const [showAllStores, setShowAllStores] = useState(false);

  // 표준 Facts 확보 (코드에서 100% 계산된 불변 지표)
  const facts: StandardReportFacts =
    report.facts.standardReport ??
    buildStandardReportFacts({
      period: report.facts.period,
      dashboard: null,
      collections: null,
    });

  // AI 문장 또는 Fallback 문장 확보
  const aiSections: StandardAiSections =
    report.standardSections ?? generateFallbackAiSections(facts);

  const { period, collection, weekly, topStores, allStores, comparison, keyChanges, dataLimitations } = facts;
  const isPartial = period.status === 'in_progress';

  const maxWeekKg = Math.max(...weekly.map(w => w.totalKg), 1);
  const maxStoreKg = Math.max(...topStores.map(s => s.totalKg), 1);

  return (
    <div className="std-report-wrapper">
      {/* ── 상단 액션 바 (화면 전용, 인쇄 시 숨김) ── */}
      <div className="std-report-actionbar">
        <button type="button" className="std-report-btn std-report-btn--back" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
          <span>요청 화면으로 돌아가기</span>
        </button>

        <div className="std-report-actionbar__right">
          <button
            type="button"
            className="std-report-btn std-report-btn--primary"
            onClick={onRegenerate}
            disabled={regenerating}
          >
            <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
            <span>{regenerating ? 'AI가 문장 작성 중...' : 'AI 문장 다시 쓰기 ✦'}</span>
          </button>
          <button
            type="button"
            className="std-report-btn std-report-btn--print"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4" />
            <span>인쇄 · PDF 저장</span>
          </button>
        </div>
      </div>

      {regenerateError && (
        <div className="std-report-alert std-report-alert--warning" role="alert">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{regenerateError} (코드 연산 수치 및 기본 표준 해설 문장으로 정상 표시됩니다.)</span>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          01 표지 (Cover Page)
          모든 월간 보고서 제목 형식: 제주도 커피박 수거 사업 YYYY년 M월 월간 현황 보고서
      ════════════════════════════════════════════════════════════ */}
      <header className="std-report-section std-report-cover">
        <div className="std-report-cover__header">
          <div className="std-report-cover__tags">
            <span className="std-badge std-badge--navy">01 표지</span>
            {isPartial ? (
              <span className="std-badge std-badge--orange">[진행 중]</span>
            ) : (
              <span className="std-badge std-badge--green">[완료]</span>
            )}
            <span className="std-badge std-badge--outline">제주 자원순환 사업단</span>
          </div>
          <span className="std-report-cover__meta-date">
            작성일시: {new Date(report.createdAt).toLocaleDateString('ko-KR')} ·{' '}
            {report.model ?? '코드 계산 & Gemini AI'}
            {reused && ' (저장본)'}
          </span>
        </div>

        <div className="std-report-cover__title-box">
          <h1 className="std-report-cover__title">{facts.title}</h1>
          <p className="std-report-cover__subtitle">{facts.subtitle}</p>
        </div>

        <div className="std-report-cover__meta-grid">
          <div className="std-report-cover__meta-item">
            <span className="std-report-cover__meta-label">분석 기간</span>
            <strong className="std-report-cover__meta-val">{period.dateRange}</strong>
            <span className="std-report-cover__meta-sub">총 {period.daysInMonth}일간 (경과 {period.elapsedDays}일)</span>
          </div>
          <div className="std-report-cover__meta-item">
            <span className="std-report-cover__meta-label">자료 출처</span>
            <strong className="std-report-cover__meta-val">제주도 커피박 수거대장</strong>
            <span className="std-report-cover__meta-sub">Google Sheets 현장 실측 원본</span>
          </div>
          <div className="std-report-cover__meta-item">
            <span className="std-report-cover__meta-label">분석 대상</span>
            <strong className="std-report-cover__meta-val">총 {collection.registeredStoreCount}개 카페 및 커피전문점</strong>
            <span className="std-report-cover__meta-sub">실수거 매장 {collection.activeStoreCount}개소</span>
          </div>
          <div className="std-report-cover__meta-item">
            <span className="std-report-cover__meta-label">데이터 분류</span>
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="std-badge std-badge--blue text-[10px]">[실측] 원본</span>
              <span className="std-badge std-badge--green text-[10px]">[계산] 코드</span>
              <span className="std-badge std-badge--purple text-[10px]">[AI 제안] 문장</span>
            </div>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════
          02 Executive Summary
          5대 핵심 KPI (총 수거량, 실수거 매장, 전월 대비, 일평균, 최다 수거 매장) + AI 요약
      ════════════════════════════════════════════════════════════ */}
      <section className="std-report-section">
        <div className="std-report-section__head">
          <span className="std-report-section__num">02</span>
          <div>
            <h2 className="std-report-section__title">Executive Summary</h2>
            <p className="std-report-section__desc">당월 핵심 운영 실적 및 성과 요약 (숫자는 코드 연산, 문장은 AI)</p>
          </div>
        </div>

        {/* 5대 핵심 KPI 카드 (순서 고정) */}
        <div className="std-kpi-grid">
          {/* KPI 1: 총 수거량 */}
          <article className="std-kpi-card std-kpi-card--primary">
            <span className="std-kpi-card__label">
              <span className="std-badge std-badge--blue text-[9px] mr-1">[실측합산]</span>
              총 수거량
            </span>
            <div className="std-kpi-card__value-box">
              <strong className="std-kpi-card__val">{collection.totalKg.toLocaleString('ko-KR')}</strong>
              <span className="std-kpi-card__unit">kg</span>
            </div>
            <span className="std-kpi-card__sub">
              {(collection.totalKg / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })} 톤 집계
            </span>
          </article>

          {/* KPI 2: 실수거 매장 */}
          <article className="std-kpi-card">
            <span className="std-kpi-card__label">
              <span className="std-badge std-badge--green text-[9px] mr-1">[계산]</span>
              실수거 매장 수
            </span>
            <div className="std-kpi-card__value-box">
              <strong className="std-kpi-card__val">{collection.activeStoreCount}</strong>
              <span className="std-kpi-card__unit">개소</span>
            </div>
            <span className="std-kpi-card__sub">
              등록 매장 {collection.registeredStoreCount}개소 (실참여율{' '}
              {collection.registeredStoreCount > 0
                ? ((collection.activeStoreCount / collection.registeredStoreCount) * 100).toFixed(0)
                : 0}
              %)
            </span>
          </article>

          {/* KPI 3: 전월 대비 증감 */}
          <article className="std-kpi-card">
            <span className="std-kpi-card__label">
              <span className="std-badge std-badge--green text-[9px] mr-1">[계산]</span>
              {isPartial ? '전월 동기간 / 전주차 대비' : '전월 대비 증감'}
            </span>
            <div className="std-kpi-card__value-box">
              {isPartial ? (
                comparison.samePeriodComparison?.changePercent != null ? (
                  <>
                    <strong
                      className={`std-kpi-card__val ${
                        comparison.samePeriodComparison.changePercent > 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : comparison.samePeriodComparison.changePercent < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : ''
                      }`}
                    >
                      {comparison.samePeriodComparison.changePercent > 0 ? '+' : ''}
                      {comparison.samePeriodComparison.changePercent.toFixed(1)}
                    </strong>
                    <span className="std-kpi-card__unit">%</span>
                  </>
                ) : (
                  <strong className="std-kpi-card__val text-amber-600 dark:text-amber-400">진행 중</strong>
                )
              ) : comparison.hasPreviousMonth && comparison.changePercent !== null ? (
                <>
                  <strong
                    className={`std-kpi-card__val ${
                      comparison.changePercent > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : comparison.changePercent < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : ''
                    }`}
                  >
                    {comparison.changePercent > 0 ? '+' : ''}
                    {comparison.changePercent.toFixed(1)}
                  </strong>
                  <span className="std-kpi-card__unit">%</span>
                </>
              ) : (
                <strong className="std-kpi-card__val text-slate-500">—</strong>
              )}
            </div>
            <span className="std-kpi-card__sub">
              {isPartial
                ? comparison.weeklyComparison
                  ? `전주차 대비 ${comparison.weeklyComparison.changePercent !== null && comparison.weeklyComparison.changePercent > 0 ? '+' : ''}${comparison.weeklyComparison.changePercent?.toFixed(1) ?? 0}%`
                  : '주차별 집계 진행 중'
                : comparison.hasPreviousMonth && comparison.previousMonthKg !== null
                ? `전월(${comparison.previousMonthKg.toLocaleString('ko-KR')}kg) 대비 ${
                    (comparison.differenceKg ?? 0) > 0 ? '+' : ''
                  }${(comparison.differenceKg ?? 0).toLocaleString('ko-KR')}kg`
                : '전월 비교 데이터 없음'}
            </span>
          </article>

          {/* KPI 4: 일평균 수거량 */}
          <article className="std-kpi-card">
            <span className="std-kpi-card__label">
              <span className="std-badge std-badge--green text-[9px] mr-1">[계산]</span>
              일평균 수거량
            </span>
            <div className="std-kpi-card__value-box">
              <strong className="std-kpi-card__val">{collection.dailyAverageKg.toFixed(1)}</strong>
              <span className="std-kpi-card__unit">kg/일</span>
            </div>
            <span className="std-kpi-card__sub">
              수거 기간 기준 (총 {period.elapsedDays}일 일할 계산)
            </span>
          </article>

          {/* KPI 5: 최다 수거 매장 */}
          <article className="std-kpi-card">
            <span className="std-kpi-card__label">
              <span className="std-badge std-badge--blue text-[9px] mr-1">[실측순위]</span>
              최다 수거 매장
            </span>
            <div className="std-kpi-card__value-box">
              <strong className="std-kpi-card__val text-[16px] truncate" title={collection.topStore?.storeName}>
                {collection.topStore?.storeName ?? '—'}
              </strong>
            </div>
            <span className="std-kpi-card__sub">
              {collection.topStore
                ? `${collection.topStore.totalKg.toLocaleString('ko-KR')}kg (전체 ${collection.topStore.sharePercent}%)`
                : '매장 실적 없음'}
            </span>
          </article>
        </div>

        {/* AI Executive Summary 요약문 (2~3문장 이내) */}
        <div className="std-ai-card">
          <div className="std-ai-card__head">
            <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span className="font-bold">AI 경영/행정 실적 요약</span>
            <span className="std-badge std-badge--purple text-[10px] ml-auto">[AI 제안]</span>
          </div>
          <p className="std-ai-card__body">{aiSections.executiveSummary}</p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          03 월간 수거 현황
          주차별 막대차트 + 일평균/비중 정량 표 + AI 추이 해설
      ════════════════════════════════════════════════════════════ */}
      <section className="std-report-section">
        <div className="std-report-section__head">
          <span className="std-report-section__num">03</span>
          <div>
            <h2 className="std-report-section__title">월간 수거 현황</h2>
            <p className="std-report-section__desc">주차별 수거량 추이 및 일평균 분석 (주차별 일수 편차 보정)</p>
          </div>
        </div>

        {/* 주차별 막대그래프 */}
        <div className="std-chart-card">
          <h3 className="std-chart-card__title">주차별 수거량 추이 (kg)</h3>
          <div className="std-bar-chart">
            {weekly.map(w => {
              const heightPct = maxWeekKg > 0 ? Math.max((w.totalKg / maxWeekKg) * 100, 4) : 4;
              return (
                <div key={w.weekNumber} className="std-bar-chart__col">
                  <span className="std-bar-chart__val">
                    {w.totalKg > 0 ? `${w.totalKg.toLocaleString('ko-KR')}kg` : '0kg'}
                  </span>
                  <div className="std-bar-chart__bar-wrap">
                    <div
                      className={`std-bar-chart__bar ${
                        w.status === 'in_progress'
                          ? 'std-bar-chart__bar--in-progress'
                          : w.totalKg === 0
                          ? 'std-bar-chart__bar--zero'
                          : ''
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <strong className="std-bar-chart__label">{w.weekLabel}</strong>
                  <span className="std-bar-chart__date">{w.dateRange}</span>
                  <span className="std-bar-chart__sub">{w.dailyAverageKg.toFixed(1)}kg/일</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 주차별 세부 현황 표 */}
        <div className="std-table-card">
          <div className="std-table-card__head">
            <h3>주차별 수거량 정량 분석표</h3>
            <span className="std-badge std-badge--green">[계산] 일평균 연산</span>
          </div>
          <div className="std-table-wrap">
            <table className="std-table">
              <thead>
                <tr>
                  <th scope="col">주차</th>
                  <th scope="col">기간</th>
                  <th scope="col" className="text-center">일수</th>
                  <th scope="col" className="text-right">수거량 (kg)</th>
                  <th scope="col" className="text-right">일평균 (kg/day)</th>
                  <th scope="col" className="text-right">월 전체 비중 (%)</th>
                  <th scope="col" className="text-center">상태</th>
                </tr>
              </thead>
              <tbody>
                {weekly.map(w => (
                  <tr key={w.weekNumber}>
                    <td className="font-bold">{w.weekLabel}</td>
                    <td className="text-slate-600 dark:text-slate-400">{w.dateRange}</td>
                    <td className="text-center">{w.days}일</td>
                    <td className="text-right font-semibold">{w.totalKg.toLocaleString('ko-KR')} kg</td>
                    <td className="text-right text-emerald-700 dark:text-emerald-400 font-bold">
                      {w.dailyAverageKg.toFixed(1)} kg/일
                    </td>
                    <td className="text-right font-medium">{w.sharePercent.toFixed(1)}%</td>
                    <td className="text-center">
                      {w.status === 'in_progress' ? (
                        <span className="std-badge std-badge--orange text-[10px]">진행 중</span>
                      ) : w.totalKg === 0 ? (
                        <span className="std-badge std-badge--gray text-[10px]">미수거/휴일</span>
                      ) : (
                        <span className="std-badge std-badge--green text-[10px]">완료</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={2} scope="row">월간 합계 / 평균</th>
                  <td className="text-center font-bold">{period.daysInMonth}일</td>
                  <td className="text-right font-bold text-emerald-800 dark:text-emerald-300">
                    {collection.totalKg.toLocaleString('ko-KR')} kg
                  </td>
                  <td className="text-right font-bold text-emerald-800 dark:text-emerald-300">
                    {collection.dailyAverageKg.toFixed(1)} kg/일
                  </td>
                  <td className="text-right font-bold">100.0%</td>
                  <td className="text-center">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="std-table-note">
            ※ 주차별 기간 일수가 서로 다를 수 있으므로(월초/월말 7일 미만 주차 등), 단순 총량 외에 일평균 수거량을 함께 계산하여 운영 효율을 공정하게 평가합니다.
          </p>
        </div>

        {/* AI 주차별 추이 해설 (1~2문장) */}
        <div className="std-ai-card mt-3">
          <div className="std-ai-card__head">
            <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span className="font-bold">주차별 수거 동향 분석</span>
            <span className="std-badge std-badge--purple text-[10px] ml-auto">[AI 제안]</span>
          </div>
          <p className="std-ai-card__body">{aiSections.trendCommentary}</p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          04 참여 매장 및 수거 기여도
          TOP 5 매장 표 + 집중도(top5Share) 분석 + "전체 매장 보기" 접기/펼치기
      ════════════════════════════════════════════════════════════ */}
      <section className="std-report-section">
        <div className="std-report-section__head">
          <span className="std-report-section__num">04</span>
          <div>
            <h2 className="std-report-section__title">참여 매장 및 수거 기여도</h2>
            <p className="std-report-section__desc">상위 핵심 매장 실적 및 특정 매장 의존도(집중도) 분석</p>
          </div>
        </div>

        {/* 상위 매장 집중도 하이라이트 배너 */}
        <div className="std-highlight-banner">
          <div className="std-highlight-banner__left">
            <Award className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            <div>
              <strong>TOP 5 매장 수거 비중: 전체의 {facts.top5SharePercent}% 점유</strong>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                상위 5개소가 총 {topStores.reduce((s, m) => s + m.totalKg, 0).toLocaleString('ko-KR')}kg을 담당하고 있습니다.
              </p>
            </div>
          </div>
          <div className="std-highlight-banner__right">
            <span className="text-xs text-slate-500">실수거 매장</span>
            <strong className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {collection.activeStoreCount} / {collection.registeredStoreCount}개소
            </strong>
          </div>
        </div>

        {/* 상위 5개 매장 테이블 */}
        <div className="std-table-card">
          <div className="std-table-card__head">
            <h3>수거량 상위 5개 매장 현황 (TOP 5)</h3>
            <span className="std-badge std-badge--blue">[실측] 구글시트</span>
          </div>
          <div className="std-table-wrap">
            <table className="std-table">
              <thead>
                <tr>
                  <th scope="col" className="text-center w-16">순위</th>
                  <th scope="col">매장명</th>
                  <th scope="col" className="text-right">수거량 (kg)</th>
                  <th scope="col" className="text-right">전체 대비 비중 (%)</th>
                  <th scope="col">기여도 시각화</th>
                </tr>
              </thead>
              <tbody>
                {topStores.map(store => {
                  const barWidth = maxStoreKg > 0 ? (store.totalKg / maxStoreKg) * 100 : 0;
                  return (
                    <tr key={store.rank}>
                      <td className="text-center font-bold text-slate-700 dark:text-slate-300">
                        {store.rank === 1 ? '🥇 1위' : store.rank === 2 ? '🥈 2위' : store.rank === 3 ? '🥉 3위' : `${store.rank}위`}
                      </td>
                      <td className="font-bold text-slate-900 dark:text-slate-100">{store.storeName}</td>
                      <td className="text-right font-bold text-emerald-800 dark:text-emerald-300">
                        {store.totalKg.toLocaleString('ko-KR')} kg
                      </td>
                      <td className="text-right font-semibold">{store.sharePercent.toFixed(1)}%</td>
                      <td className="w-48">
                        <div className="std-table-bar-wrap">
                          <div className="std-table-bar" style={{ width: `${barWidth}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 전체 매장 보기 접기/펼치기 토글 버튼 */}
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            className="std-report-btn std-report-btn--secondary"
            onClick={() => setShowAllStores(!showAllStores)}
          >
            {showAllStores ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>전체 매장 목록 접기</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>전체 매장 수거 현황 보기 (총 {allStores.length}개소)</span>
              </>
            )}
          </button>
        </div>

        {/* 전체 매장 목록 (펼쳤을 때 표시) */}
        {showAllStores && (
          <div className="std-table-card mt-3">
            <div className="std-table-card__head">
              <h3>전체 참여 매장 수거 실적 대장 (총 {allStores.length}개소)</h3>
            </div>
            <div className="std-table-wrap max-h-80 overflow-y-auto">
              <table className="std-table">
                <thead>
                  <tr>
                    <th scope="col" className="text-center w-16">순위</th>
                    <th scope="col">매장명</th>
                    <th scope="col" className="text-right">수거량 (kg)</th>
                    <th scope="col" className="text-right">비중 (%)</th>
                    <th scope="col" className="text-center">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {allStores.map(store => (
                    <tr key={store.rank}>
                      <td className="text-center text-xs font-semibold text-slate-500">{store.rank}</td>
                      <td className="font-medium text-slate-800 dark:text-slate-200">{store.storeName}</td>
                      <td className="text-right font-semibold">
                        {store.totalKg > 0 ? `${store.totalKg.toLocaleString('ko-KR')} kg` : '0 kg'}
                      </td>
                      <td className="text-right">{store.sharePercent.toFixed(1)}%</td>
                      <td className="text-center">
                        {store.totalKg === 0 ? (
                          <span className="std-badge std-badge--gray text-[10px]">미수거(0kg)</span>
                        ) : (
                          <span className="std-badge std-badge--green text-[10px]">정상 수거</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════
          05 전월 대비 및 주요 변화
          전월 실적 3대 지표 비교 (진행 중일 땐 진행 중 배지 및 안내) + 코드 감지 특이사항
      ════════════════════════════════════════════════════════════ */}
      <section className="std-report-section">
        <div className="std-report-section__head">
          <span className="std-report-section__num">05</span>
          <div>
            <h2 className="std-report-section__title">전월 대비 및 주요 변화</h2>
            <p className="std-report-section__desc">전월 대비 정량 실적 비교 및 코드가 감지한 월간 특이사항</p>
          </div>
        </div>

        {/* 진행 중인 월 안내 배너 (해당 시) */}
        {isPartial && (
          <div className="std-report-alert std-report-alert--info mb-3">
            <span className="std-badge std-badge--orange mr-2">[진행 중]</span>
            <span>
              현재 월 데이터는 집계 중이므로 월 마감 이후 최종 수치가 변경될 수 있습니다. (진행 중인 월을 전월 전체 데이터와 단순 비교하여 확정적인 감소/증가로 단정하지 않습니다.)
            </span>
          </div>
        )}

        {/* 전월 대비 3대 지표 비교 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 지표 1: 총 수거량 증감 */}
          <div className="std-compare-card">
            <span className="std-compare-card__label">총 수거량 증감</span>
            {comparison.hasPreviousMonth && comparison.previousMonthKg !== null ? (
              <>
                <div className="std-compare-card__body">
                  <div>
                    <span className="text-xs text-slate-500">전월</span>
                    <strong className="block text-sm text-slate-700 dark:text-slate-300">
                      {comparison.previousMonthKg.toLocaleString('ko-KR')} kg
                    </strong>
                  </div>
                  <span className="text-slate-400">→</span>
                  <div>
                    <span className="text-xs text-slate-500">당월</span>
                    <strong className="block text-sm text-emerald-700 dark:text-emerald-400">
                      {collection.totalKg.toLocaleString('ko-KR')} kg
                    </strong>
                  </div>
                </div>
                <div className="std-compare-card__diff">
                  <span>증감: </span>
                  <strong
                    className={
                      (comparison.differenceKg ?? 0) > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : (comparison.differenceKg ?? 0) < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : ''
                    }
                  >
                    {(comparison.differenceKg ?? 0) > 0 ? '+' : ''}
                    {(comparison.differenceKg ?? 0).toLocaleString('ko-KR')} kg ({comparison.changePercent !== null && comparison.changePercent > 0 ? '+' : ''}
                    {comparison.changePercent?.toFixed(1) ?? 0}%)
                  </strong>
                </div>
              </>
            ) : (
              <div className="py-4 text-center text-xs text-slate-500 font-medium">
                전월 비교 데이터 없음 (사업 개시 월)
              </div>
            )}
          </div>

          {/* 지표 2: 실수거 매장 증감 */}
          <div className="std-compare-card">
            <span className="std-compare-card__label">실수거 매장 수</span>
            <div className="std-compare-card__body">
              <div>
                <span className="text-xs text-slate-500">등록 매장</span>
                <strong className="block text-sm text-slate-700 dark:text-slate-300">
                  {collection.registeredStoreCount} 개소
                </strong>
              </div>
              <span className="text-slate-400">/</span>
              <div>
                <span className="text-xs text-slate-500">실수거 매장</span>
                <strong className="block text-sm text-emerald-700 dark:text-emerald-400">
                  {collection.activeStoreCount} 개소
                </strong>
              </div>
            </div>
            <div className="std-compare-card__diff">
              <span>수거 참여율: </span>
              <strong className="text-emerald-700 dark:text-emerald-400">
                {collection.registeredStoreCount > 0
                  ? ((collection.activeStoreCount / collection.registeredStoreCount) * 100).toFixed(1)
                  : 0}
                %
              </strong>
            </div>
          </div>

          {/* 지표 3: 일평균 수거량 증감 */}
          <div className="std-compare-card">
            <span className="std-compare-card__label">일평균 수거량</span>
            {comparison.previousDailyAverageKg !== null ? (
              <>
                <div className="std-compare-card__body">
                  <div>
                    <span className="text-xs text-slate-500">전월 일평균</span>
                    <strong className="block text-sm text-slate-700 dark:text-slate-300">
                      {comparison.previousDailyAverageKg.toFixed(1)} kg/일
                    </strong>
                  </div>
                  <span className="text-slate-400">→</span>
                  <div>
                    <span className="text-xs text-slate-500">당월 일평균</span>
                    <strong className="block text-sm text-emerald-700 dark:text-emerald-400">
                      {collection.dailyAverageKg.toFixed(1)} kg/일
                    </strong>
                  </div>
                </div>
                <div className="std-compare-card__diff">
                  <span>일평균 편차: </span>
                  <strong
                    className={
                      (comparison.dailyAverageDifference ?? 0) > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : (comparison.dailyAverageDifference ?? 0) < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : ''
                    }
                  >
                    {(comparison.dailyAverageDifference ?? 0) > 0 ? '+' : ''}
                    {(comparison.dailyAverageDifference ?? 0).toFixed(1)} kg/일
                  </strong>
                </div>
              </>
            ) : (
              <div className="py-4 text-center text-xs text-slate-500 font-medium">
                당월 일평균: {collection.dailyAverageKg.toFixed(1)} kg/일
              </div>
            )}
          </div>
        </div>

        {/* 코드가 감지한 주요 변화 리스트 (AI가 자의적으로 원인을 지어내지 않도록 사전 추출) */}
        <div className="std-key-changes mt-3">
          <h3 className="std-key-changes__title">시스템 코드 감지 주요 변화 지표</h3>
          <div className="std-key-changes__grid">
            <div className="std-key-changes__item">
              <span className="std-key-changes__tag">최고 수거 주차</span>
              <p>
                {keyChanges.highestWeek
                  ? `${keyChanges.highestWeek.weekLabel} (${keyChanges.highestWeek.totalKg.toLocaleString('ko-KR')}kg · 일평균 ${keyChanges.highestWeek.dailyAverageKg.toFixed(1)}kg/일)`
                  : '집계 자료 없음'}
              </p>
            </div>
            <div className="std-key-changes__item">
              <span className="std-key-changes__tag">최저 수거 주차</span>
              <p>
                {keyChanges.lowestWeek
                  ? `${keyChanges.lowestWeek.weekLabel} (${keyChanges.lowestWeek.totalKg.toLocaleString('ko-KR')}kg · 일평균 ${keyChanges.lowestWeek.dailyAverageKg.toFixed(1)}kg/일)`
                  : '집계 자료 없음'}
              </p>
            </div>
            <div className="std-key-changes__item">
              <span className="std-key-changes__tag">매장 집중도</span>
              <p>
                상위 5개소 수거 비중 {keyChanges.top5SharePercent}% (1위 매장 점유율 {keyChanges.top1SharePercent}%)
              </p>
            </div>
            <div className="std-key-changes__item">
              <span className="std-key-changes__tag">미배출(0kg) 매장</span>
              <p>
                {keyChanges.zeroStores.length > 0
                  ? `${keyChanges.zeroStores.slice(0, 3).join(', ')}${keyChanges.zeroStores.length > 3 ? ` 외 ${keyChanges.zeroStores.length - 3}곳` : ''} (총 ${keyChanges.zeroStores.length}개소)`
                  : '전 매장 정상 배출 확인'}
              </p>
            </div>
            <div className="std-key-changes__item">
              <span className="std-key-changes__tag">신규 참여 매장</span>
              <p>{keyChanges.newStores.length > 0 ? keyChanges.newStores.join(', ') : '당월 신규 추가 매장 없음'}</p>
            </div>
            <div className="std-key-changes__item">
              <span className="std-key-changes__tag">주차별 급격한 변동</span>
              <p>{keyChanges.fluctuations.length > 0 ? keyChanges.fluctuations.join(' / ') : '급격한 주간 변동 없음 (안정적 추이)'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          06 운영 이슈 및 다음 행동
          운영 이슈 최대 3개 (이슈 -> 근거 -> 권장 행동) + 다음 달 구체적 실행 행동 3개
      ════════════════════════════════════════════════════════════ */}
      <section className="std-report-section">
        <div className="std-report-section__head">
          <span className="std-report-section__num">06</span>
          <div>
            <h2 className="std-report-section__title">운영 이슈 및 다음 행동</h2>
            <p className="std-report-section__desc">정량 근거 기반의 핵심 이슈 진단 및 구체적 개선 조치 계획</p>
          </div>
        </div>

        {/* 운영 이슈 3단계 카드 리스트 */}
        <div className="space-y-3">
          {aiSections.issues.map((issue, idx) => (
            <div key={idx} className="std-issue-card">
              <div className="std-issue-card__header">
                <span className="std-badge std-badge--navy text-xs">이슈 0{idx + 1}</span>
                <strong className="std-issue-card__title">{issue.title}</strong>
              </div>
              <div className="std-issue-card__flow">
                <div className="std-issue-card__step">
                  <span className="std-issue-card__step-label">📊 데이터 근거</span>
                  <p className="std-issue-card__step-text">{issue.description}</p>
                </div>
                <div className="std-issue-card__arrow">↓</div>
                <div className="std-issue-card__step std-issue-card__step--action">
                  <span className="std-issue-card__step-label">🎯 권장 실행 조치</span>
                  <p className="std-issue-card__step-text font-semibold text-emerald-800 dark:text-emerald-300">
                    {issue.action}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 다음 달 행동 체크리스트 */}
        <div className="std-next-actions mt-4">
          <h3 className="std-next-actions__title">다음 달 실행 과제 (Next Actions)</h3>
          <ul className="std-next-actions__list">
            {aiSections.nextActions.map((action, idx) => (
              <li key={idx} className="std-next-actions__item">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <span className="font-medium text-slate-800 dark:text-slate-200">{action}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          07 데이터 근거와 한계
          고정 출처, 분석 기간, 배지 분류 의미, 환경효과 산출 주의 안내
      ════════════════════════════════════════════════════════════ */}
      <section className="std-report-section std-report-basis">
        <div className="std-report-section__head">
          <span className="std-report-section__num">07</span>
          <div>
            <h2 className="std-report-section__title">데이터 근거와 한계</h2>
            <p className="std-report-section__desc">보고서에 사용된 자료의 출처, 산출 기준 및 데이터 한계 정의</p>
          </div>
        </div>

        <div className="std-basis-grid">
          <div className="std-basis-item">
            <span className="std-basis-label">자료 출처</span>
            <strong>{dataLimitations.source}</strong>
          </div>
          <div className="std-basis-item">
            <span className="std-basis-label">분석 기간</span>
            <strong>{dataLimitations.periodText}</strong>
          </div>
          <div className="std-basis-item">
            <span className="std-basis-label">데이터 상태</span>
            <strong>{dataLimitations.statusText}</strong>
          </div>
        </div>

        {/* 데이터 출처 배지 설명표 */}
        <div className="std-badge-explainer mt-3">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">데이터 신뢰도 및 분류 체계</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <span className="std-badge std-badge--blue text-[10px]">[실측] 구글 시트 원본</span>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                매장별 주차 수거량, 참여 매장 명단 등 원본 시트 실측 기록
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <span className="std-badge std-badge--green text-[10px]">[계산] 시스템 코드 연산</span>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                월간 총량, 일평균(kg/day), 순위, 점유율, 전월 대비 증감률 등 일체
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
              <span className="std-badge std-badge--purple text-[10px]">[AI 제안] Gemini 해석</span>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                계산된 facts를 바탕으로 작성된 Executive Summary 및 운영 권장 조치
              </p>
            </div>
          </div>
        </div>

        {/* 환경효과 산출 주의 안내 */}
        <div className="std-report-alert std-report-alert--neutral mt-3">
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {dataLimitations.environmentalNotice}
          </p>
        </div>
      </section>

      {/* ── 하단 액션 버튼 (인쇄 시 숨김) ── */}
      <div className="std-report-footer-actions">
        <button
          type="button"
          className="std-report-btn std-report-btn--secondary"
          onClick={onRegenerate}
          disabled={regenerating}
        >
          <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
          <span>{regenerating ? 'AI가 다시 쓰는 중...' : '해석 문장 다시 다듬기 ✦'}</span>
        </button>
        <button
          type="button"
          className="std-report-btn std-report-btn--primary"
          onClick={() => window.print()}
        >
          <Printer className="w-4 h-4" />
          <span>인쇄 · PDF 보고서 저장</span>
        </button>
      </div>
    </div>
  );
};
