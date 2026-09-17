import { useCallback, useEffect, useMemo, useState } from 'react';
import { gasApi, getCollectionSheetUrl, type CollectionData, type DashboardData } from '../../services/gasClient';
import { isImplausiblePrevious } from '../../services/reportData';
import '../../styles/collection-impact.css';

const YEARS = [2026, 2025] as const;

function getAvailableMonths(year: number): number[] {
  if (year === 2025) {
    // 2025년 수거는 4월(시범 운영)부터 시작
    return [4, 5, 6, 7, 8, 9, 10, 11, 12];
  }
  // 2026년은 현재 9월까지 수거 데이터 작성 완료
  return [1, 2, 3, 4, 5, 6, 7, 8, 9];
}

function getInitialPeriod() {
  const now = new Date();
  const year = YEARS.includes(now.getFullYear() as (typeof YEARS)[number]) ? now.getFullYear() : 2026;
  const currentMonth = now.getMonth() + 1;
  const available = getAvailableMonths(year);
  const month = available.includes(currentMonth) ? currentMonth : available[available.length - 1];
  return { year, month };
}

function formatKg(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value).toLocaleString('ko-KR')} kg`;
}

function formatTons(value: number) {
  if (value < 1000) return formatKg(value);
  return `${(value / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })} t`;
}

interface CollectionImpactDashboardProps {
  /** 리포트 안에 넣을 때 — 기간을 밖에서 정하고 기간 선택 줄은 감춘다 */
  year?: number;
  month?: number;
  embedded?: boolean;
}

export function CollectionImpactDashboard({ year: fixedYear, month: fixedMonth, embedded }: CollectionImpactDashboardProps = {}) {
  const initial = useMemo(getInitialPeriod, []);
  const [year, setYear] = useState(fixedYear ?? initial.year);
  const [month, setMonth] = useState(fixedMonth ?? initial.month);

  useEffect(() => {
    if (fixedYear !== undefined) setYear(fixedYear);
    if (fixedMonth !== undefined) setMonth(fixedMonth);
  }, [fixedYear, fixedMonth]);

  // 연도 변경 시 지원하는 월 목록에 맞게 월 자동 보정
  const availableMonths = useMemo(() => getAvailableMonths(year), [year]);
  useEffect(() => {
    if (!availableMonths.includes(month)) {
      setMonth(availableMonths[availableMonths.length - 1]);
    }
  }, [availableMonths, month]);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [collections, setCollections] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardData, collectionData] = await Promise.all([
        gasApi.dashboard(year, month),
        gasApi.collections(year, month),
      ]);
      setDashboard(dashboardData);
      setCollections(collectionData);
    } catch (err) {
      setDashboard(null);
      setCollections(null);
      setError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  // 지난달 값이 이번 달과 자릿수부터 다르면(수거 시트 집계 오류) 비교를 숨긴다
  const previousBroken =
    dashboard !== null &&
    dashboard.collection.previousMonthKg !== null &&
    isImplausiblePrevious(dashboard.collection.previousMonthKg, dashboard.collection.totalKg);
  const changePercent = previousBroken ? null : dashboard?.collection.changePercent ?? null;

  // 비교 모드: 진행 중인 월이면 기본 'week'(전주차), 완료된 월이면 기본 'month'(전월)
  const [compareMode, setCompareMode] = useState<'week' | 'month'>('week');
  useEffect(() => {
    if (dashboard) {
      setCompareMode(dashboard.collection.isPartialMonth ? 'week' : 'month');
    }
  }, [dashboard?.period.year, dashboard?.period.month, dashboard?.collection.isPartialMonth]);

  const maxWeek = Math.max(...(dashboard?.collection.weeklyKg || [0]), 1);
  const maxStore = Math.max(...(dashboard?.topStores.map((store) => store.totalKg) || [0]), 1);

  const sheetUrl = getCollectionSheetUrl(year, month);

  // 주차별 / 전월 / 동기간 비교 지표 텍스트 계산
  const isPartial = dashboard?.collection.isPartialMonth ?? false;
  const weekly = dashboard?.collection.weeklyComparison;
  const samePeriod = dashboard?.collection.samePeriodComparison;

  const weekDiffKg = weekly?.changeKg ?? 0;
  const weekPercent = weekly?.changePercent;
  const weekText =
    weekPercent !== null && weekPercent !== undefined
      ? `${weekPercent > 0 ? '+' : ''}${weekPercent.toFixed(1)}%`
      : '진행 중';
  const weekSubtext = weekly
    ? weekly.prevWeek > 0
      ? `${weekly.currentWeek}주차(${weekly.currentKg.toLocaleString()}kg) · ${weekly.prevWeek}주차 대비 ${weekDiffKg > 0 ? '+' : ''}${weekDiffKg.toLocaleString()}kg`
      : `${weekly.currentWeek}주차 수거 진행 중 (${weekly.currentKg.toLocaleString()}kg)`
    : '주차 데이터 없음';

  let monthText = '—';
  let monthSubtext = '';
  if (isPartial) {
    if (samePeriod && samePeriod.changePercent !== null) {
      monthText = `${samePeriod.changePercent > 0 ? '+' : ''}${samePeriod.changePercent.toFixed(1)}%`;
      const diffKg = samePeriod.changeKg ?? 0;
      monthSubtext = `전월 1~${samePeriod.weeksCount}주(${samePeriod.prevMonthWeeksKg?.toLocaleString()}kg) 대비 ${diffKg > 0 ? '+' : ''}${diffKg.toLocaleString()}kg (전월의 ${samePeriod.achievementPercent}%)`;
    } else {
      monthText = changePercent !== null ? `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%` : '—';
      monthSubtext = `전월 전체 대비 (현재 진행 중)`;
    }
  } else {
    monthText = changePercent !== null ? `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%` : '—';
    const diff =
      dashboard?.collection.previousMonthKg != null
        ? Math.round(dashboard.collection.totalKg - dashboard.collection.previousMonthKg)
        : null;
    monthSubtext =
      dashboard?.collection.previousMonthKg != null
        ? `전월(${dashboard.collection.previousMonthKg.toLocaleString()}kg) 대비 ${diff && diff > 0 ? '+' : ''}${diff?.toLocaleString()}kg`
        : '전월 비교 데이터 없음';
  }

  return (
    <div className="collection-impact">
      {!embedded && (
      <section className="collection-impact__toolbar" aria-label="조회 기간">
        <div>
          <p className="collection-impact__eyebrow">수거 데이터 우선 모드</p>
          <h2>수거 & 임팩트 대시보드</h2>
          <p>Google Sheets의 실제 수거 기록을 기준으로 집계합니다.</p>
        </div>
        <div className="collection-impact__period-controls">
          <label>
            <span>연도</span>
            <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {YEARS.map((item) => <option key={item} value={item}>{item}년</option>)}
            </select>
          </label>
          <label>
            <span>월</span>
            <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void load()} disabled={loading}>새로고침</button>
          <a
            href={sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="collection-impact__sheet-link"
          >
            <span>🔗 구글 시트 원본 ({year}년 {month}월) ↗</span>
          </a>
        </div>
      </section>
      )}

      {error && (
        <section className="collection-impact__state collection-impact__state--error" role="alert">
          <strong>데이터를 불러오지 못했습니다.</strong>
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>다시 시도</button>
        </section>
      )}

      {loading && !dashboard && (
        <section className="collection-impact__state" aria-live="polite">
          <strong>수거 데이터를 불러오는 중입니다.</strong>
          <p>Google Sheets → Apps Script 데이터를 확인하고 있습니다.</p>
        </section>
      )}

      {dashboard && collections && (
        <>
          {dashboard.collection.isPartialMonth && (
            <div className="collection-impact__notice">
              <span className="collection-impact__badge">실측 · 진행 중</span>
              현재 월은 아직 진행 중이므로 누적 수거량이 최종 월 실적이 아닙니다.
            </div>
          )}

          <section className="collection-impact__metrics" aria-label="핵심 수거 지표">
            <article className="collection-impact__metric collection-impact__metric--primary">
              <span className="collection-impact__badge">실측</span>
              <p>이번 달 수거량</p>
              <strong>{formatTons(dashboard.collection.totalKg)}</strong>
              <small>{dashboard.period.year}년 {dashboard.period.month}월 누적</small>
            </article>
            <article className="collection-impact__metric">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span className="collection-impact__badge">
                  {compareMode === 'week' ? '주간 추이' : (isPartial ? '동기간 대비' : '전월 대비')}
                </span>
                <div className="collection-impact__pill-group" role="tablist" aria-label="비교 모드 선택">
                  <button
                    type="button"
                    className={`collection-impact__pill-tab ${compareMode === 'week' ? 'active' : ''}`}
                    onClick={() => setCompareMode('week')}
                  >
                    전주차
                  </button>
                  <button
                    type="button"
                    className={`collection-impact__pill-tab ${compareMode === 'month' ? 'active' : ''}`}
                    onClick={() => setCompareMode('month')}
                  >
                    {isPartial ? '전월동기' : '전월'}
                  </button>
                </div>
              </div>

              {compareMode === 'week' ? (
                <>
                  <p>전주차 대비 {weekDiffKg > 0 ? '증가' : weekDiffKg < 0 ? '감소' : ''}</p>
                  <strong style={{ color: weekPercent != null ? (weekPercent > 0 ? '#34c759' : weekPercent < 0 ? '#ff453a' : 'inherit') : 'inherit' }}>
                    {weekText}
                  </strong>
                  <small>{weekSubtext}</small>
                </>
              ) : (
                <>
                  <p>{isPartial ? '전월 동기간 대비' : '전월 대비'}</p>
                  <strong style={{ color: monthText.startsWith('+') ? '#34c759' : monthText.startsWith('-') ? '#ff453a' : 'inherit' }}>
                    {monthText}
                  </strong>
                  <small>{monthSubtext}</small>
                </>
              )}
            </article>
            <article className="collection-impact__metric">
              <span className="collection-impact__badge">실측</span>
              <p>수거 발생 매장</p>
              <strong>{dashboard.collection.activeStoreCount.toLocaleString('ko-KR')}곳</strong>
              <small>해당 월 수거량이 있는 매장</small>
            </article>
            <article className="collection-impact__metric">
              <span className="collection-impact__badge">운영 기준</span>
              <p>현재 운영 목장</p>
              <strong>{dashboard.operatingFarm?.name || '—'}</strong>
              <small>{dashboard.operatingFarm?.role === 'CURRENT_OPERATION' ? '현재 운영' : '기간 기준 자동 선택'}</small>
            </article>
          </section>

          <section className="collection-impact__grid">
            <article className="collection-impact__card">
              <div className="collection-impact__card-head">
                <div>
                  <span className="collection-impact__badge">실측</span>
                  <h3>주차별 수거량</h3>
                </div>
                <strong>{formatKg(dashboard.collection.totalKg)}</strong>
              </div>
              <div className="collection-impact__week-chart" aria-label="주차별 수거량 막대 그래프">
                {dashboard.collection.weeklyKg.map((kg, index) => (
                  <div className="collection-impact__week" key={index}>
                    <div className="collection-impact__bar-track">
                      <div className="collection-impact__bar" style={{ height: `${Math.max((kg / maxWeek) * 100, kg > 0 ? 5 : 0)}%` }} />
                    </div>
                    <strong>{kg ? Math.round(kg).toLocaleString('ko-KR') : '0'}</strong>
                    <span>{index + 1}주차</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="collection-impact__card">
              <div className="collection-impact__card-head">
                <div>
                  <span className="collection-impact__badge">실측</span>
                  <h3>수거량 상위 매장</h3>
                </div>
                <small>Top {dashboard.topStores.length}</small>
              </div>
              <div className="collection-impact__ranking">
                {dashboard.topStores.map((store, index) => (
                  <div className="collection-impact__rank-row" key={`${store.no}-${store.storeName}`}>
                    <span className="collection-impact__rank-number">{index + 1}</span>
                    <div className="collection-impact__rank-main">
                      <div className="collection-impact__rank-label">
                        <strong>{store.storeName}</strong>
                        <span>{formatKg(store.totalKg)}</span>
                      </div>
                      <div className="collection-impact__rank-track">
                        <div className="collection-impact__rank-fill" style={{ width: `${Math.max((store.totalKg / maxStore) * 100, 2)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
                {!dashboard.topStores.length && <p className="collection-impact__empty">수거 실적이 없습니다.</p>}
              </div>
            </article>
          </section>

          <section className="collection-impact__card collection-impact__table-card">
            <div className="collection-impact__card-head">
              <div>
                <span className="collection-impact__badge">실측 원본 집계</span>
                <h3>매장별 수거 현황</h3>
              </div>
              <small>{collections.stores.length.toLocaleString('ko-KR')}개 매장</small>
            </div>
            <div className="collection-impact__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>매장</th>
                    {collections.weeklyKg.map((_, index) => <th key={index}>{index + 1}주</th>)}
                    <th>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.stores.map((store) => (
                    <tr key={`${store.no}-${store.storeName}`}>
                      <td>{store.storeName}</td>
                      {store.weeklyKg.map((kg, index) => <td key={index}>{kg ? Math.round(kg).toLocaleString('ko-KR') : '—'}</td>)}
                      <td><strong>{Math.round(store.totalKg).toLocaleString('ko-KR')}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="collection-impact__provenance" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="collection-impact__badge">데이터 기준</span>
              <a
                href={sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="collection-impact__footer-link"
              >
                Google Sheets 원본 시트 바로가기 ({dashboard.period.year}년 {dashboard.period.month}월) ↗
              </a>
            </div>
            <p style={{ margin: 0, fontSize: '13px' }}>
              수거량은 {dashboard.period.year}년 수거대장 {dashboard.period.month}월 시트의 주차별 실제 입력값을 기준으로 정밀 집계합니다.
              탄소 감축량·톱밥 절감액 등 검증되지 않은 환산값은 현재 화면에 표시하지 않습니다.
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
