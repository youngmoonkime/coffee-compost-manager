import React, { useEffect, useRef, useState } from 'react';
import { sawdustSavingFromAmounts } from '../../utils/sawdustSaving';
import { useCompost } from '../../contexts/CompostContext';
import { useTheme } from '../../contexts/ThemeContext';
import './barnSimulation.css';

interface SimulationEvidence {
  title: string;
  badge: string;
  source: string;
  summary: string;
  details: string[];
}

const SIMULATION_EVIDENCES: Record<string, SimulationEvidence> = {
  odor: {
    title: '예상 악취 변화',
    badge: '농촌진흥청 축산 실증 시험',
    source: '농촌진흥청 국립축산과학원 축사 환경 개선 연구 및 한우 깔개 실증 시험 (2020~2023)',
    summary: '커피박을 축사 톱밥 깔개와 혼합(25%~75%) 도포했을 때 복합악취(희석배수)의 시계열 상대 변화율을 적용한 모델입니다.',
    details: [
      '커피박 특유의 미세 다공성 분자 구조와 리그닌 성분이 암모니아(NH₃) 및 황화수소(H₂S) 등 주요 악취 가스를 물리·화학적으로 강력히 흡착합니다.',
      '실증 데이터 기준, 50% 혼합 도포 시 초기 농도 대비 7~14일 차에 복합악취 희석배수가 70% 수준까지 감소하는 경향을 반영하였습니다.',
      '본 수치는 통제된 표준 연구 조건의 상대 변화율을 적용한 참고 지표이며, 외기 기상 및 환기 방식에 따라 현장 실측치는 달라질 수 있습니다.',
    ],
  },
  saving: {
    title: '예상 톱밥 구매 절감',
    badge: '축산농가 깔개 수급 실무 기준',
    source: '앱 설정의 톱밥 단가(원/톤)와 목장 월 톱밥 소요량 · 커피박 혼합 시 톱밥 구매 50% 절감 가정',
    summary: '커피박을 깔개로 섞어 쓰면 톱밥 구매가 50% 줄어든다고 보고, 줄어드는 톱밥 양에 톤 단가를 곱한 추정입니다.',
    details: [
      '산출 공식: min(월 톱밥 소요량 × 50%, 커피박 사용량) × 톱밥 톤당 단가',
      '커피박이 모자라면 사용한 커피박만큼만, 넘치면 소요량의 50%까지만 절감으로 인정합니다.',
      '월 톱밥 소요량은 축종·두수·계절에 따라 크게 달라집니다 (예: 한우 100두 월 15~20톤). 실제 구입량을 넣어 주세요.',
      '기본값은 설정 > 목장 설정의 기본 톱밥 단가와 목장별 월 소요량에서 가져옵니다. 운송·처리비는 빼지 않았습니다.',
    ],
  },
  cycle: {
    title: '경과 일수 및 혼합비',
    badge: '가축 깔개 부숙 사이클 모델',
    source: '커피박-톱밥 혼합 깔개의 수분 흡수 및 호기성 발효 지속 시험 데이터',
    summary: '깔개 도포 직후(0일)부터 30일까지의 미생물 발효 진행 및 보송한 바닥 상태 유지 주기입니다.',
    details: [
      '혼합비(25%, 50%, 75%)에 따라 초기 수분 흡착량과 미생물 발효 속도가 다르게 전개됩니다.',
      '혼합비 50% 기준 약 7~14일 차에 발효열 발생과 수분 증발의 균형이 가장 최적화되어 악취 흡착 및 깔개 건조 효과가 극대화됩니다.',
    ],
  },
  mass: {
    title: '커피박 사용량',
    badge: '현장 실투입 계량 기준',
    source: '커피박 부숙 관리 대장 및 매장별 정기 수거량 실측치',
    summary: '해당 축사 구역에 실제로 살포·도포된 커피박의 총 중량(kg)입니다.',
    details: [
      '축사 면적(㎡)당 약 5~15kg/㎡ 투입을 권장하며, 바닥 두께 약 5~10cm 깔개층을 형성합니다.',
      '수거된 커피박의 수분율(평균 55~65%) 상태에 따라 전체 바닥의 수분 조절 능력이 결정됩니다.',
    ],
  },
  size: {
    title: '축사 크기 및 면적',
    badge: '한우 표준 축사 건축 규격',
    source: '측정동 현장 실측 및 농가 축사 표준 규격',
    summary: '측정동 축사의 길이(m)와 폭(m)을 곱한 유효 바닥 면적(㎡)입니다.',
    details: [
      '축사 바닥 면적은 필요한 총 깔개 부피와 사육 두수별 가스 확산 면적을 결정하는 기본 기준값입니다.',
      '3D 시뮬레이터에서 규격을 변경하면 필요한 커피박 권장량과 센서 간격이 자동으로 연동됩니다.',
    ],
  },
  sensor: {
    title: '센서 위치 및 악취 공간 보간',
    badge: '공간 통계 IDW 알고리즘',
    source: '축사 전/후방 IoT 센서 실측치 및 역거리 가중법(IDW: Inverse Distance Weighting)',
    summary: '설치된 IoT 센서들의 지점별 희석배수 실측값을 3D 바닥 전체에 16,000 포인트로 매끄럽게 연결한 가상 악취 분포입니다.',
    details: [
      '각 센서 지점으로부터의 거리에 반비례하는 가중치를 부여하여 축사 전 구역의 복합악취 농도를 연속적으로 추정합니다.',
      '정밀 유체역학(CFD) 기류 해석은 아니며, 두 측정점 사이의 상대적 악취 농도 구배를 직관적으로 파악하기 위한 시각화 모델입니다.',
    ],
  },
  overview: {
    title: '시뮬레이션 산출 근거 종합 안내',
    badge: '연구 및 실무 통합 모델',
    source: '농촌진흥청 축산과학원 연구 논문, 전국 축협 단가 기준, IoT 실측 공간 보간 기법 통합',
    summary: '커피박 자원순환을 통한 축사 환경 개선 효과를 과학적 연구 데이터와 경제성 지표로 검증한 시뮬레이션입니다.',
    details: [
      '복합악취 저감: 커피박 다공성 탄소 구조의 물리화학적 악취 가스 흡착 실증치 반영',
      '톱밥 비용 절감: 월 톱밥 소요량의 50% 한도에서 커피박 사용량만큼 줄어드는 톱밥 구매비 추정',
      '공간 악취 분포: 실측 센서 2점 기반의 IDW 보간 알고리즘 시각화',
      '본 시뮬레이션은 농가의 실제 적용 시 참고할 수 있는 예측 지표를 제공합니다.',
    ],
  },
};

interface BarnSensor {
  name: string;
  x: number;
  y: number;
  z: number;
  value: number;
}

interface BarnData {
  id: number;
  name: string;
  length: number;
  width: number;
  x: number;
  y: number;
  turn: number;
  height: number;
  passage: 'none' | 'left' | 'center' | 'right';
  alley: number;
  a: number;
  b: number;
  z: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  mix: number;
  day: number;
  mass: number;
  /** 월 톱밥 소요량(톤). 0 이면 아직 넣지 않은 것 */
  demand: number;
  /** 톱밥 단가(원/톤) */
  price: number;
  sensors?: BarnSensor[];
}

export const SimulationView: React.FC = () => {
  const { setActiveTab, settings } = useCompost();
  /** 시뮬레이터가 처음 뜰 때 설정의 톱밥 단가·소요량을 기본값으로 쓴다 */
  const settingsRef = useRef(settings);
  const { theme, toggleTheme } = useTheme();
  const [selectedInfoKey, setSelectedInfoKey] = useState<string | null>(null);
  /** 삭제를 누르면 바로 지우지 않고 한 번 되묻는다 (휴대폰에서 잘못 눌러 사라지는 일을 막는다) */
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; onlyOne: boolean } | null>(null);
  /** 확인 창에서 [삭제]를 눌렀을 때 실제로 지우는 함수 — 아래 효과가 채운다 */
  const removeBarnRef = useRef<((id: number) => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** 처음 그려진 마크업. 아래 효과가 다시 돌 때 항상 이 상태에서 시작한다 */
  const pristineRef = useRef<DocumentFragment | null>(null);
  /** 테마가 바뀌었을 때 3D 장면만 다시 그리게 하는 연결 고리 */
  const redrawRef = useRef<(() => void) | null>(null);
  /** 효과를 다시 만들지 않고도 최신 콜백을 쓰기 위한 보관함 */
  const handlersRef = useRef({ setActiveTab, toggleTheme, setSelectedInfoKey, setDeleteTarget });

  useEffect(() => {
    handlersRef.current = { setActiveTab, toggleTheme, setSelectedInfoKey, setDeleteTarget };
    settingsRef.current = settings;
  });

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    /*
     * 이 모듈은 리액트가 그려 둔 마크업을 직접 옮기고 지워서 화면을 만든다.
     * 그래서 효과가 두 번째로 돌면(개발 모드의 이중 실행, 테마 변경, 화면 재진입)
     * 이미 뜯어고친 DOM 을 또 뜯어고쳐 3D 캔버스가 화면 밖으로 떨어져 나갔다.
     * 처음 마크업을 떠 두고 늘 같은 자리에서 다시 시작한다.
     */
    if (!pristineRef.current) {
      const snapshot = document.createDocumentFragment();
      root.childNodes.forEach(node => snapshot.append(node.cloneNode(true)));
      pristineRef.current = snapshot;
    } else {
      root.replaceChildren(...Array.from(pristineRef.current.childNodes, node => node.cloneNode(true)));
    }

    /*
     * 화면 전환 애니메이션(.view-enter)이 남긴 transform·will-change 가 있으면
     * 그 상자가 position: fixed 의 기준이 되어 설정 팝업이 화면 밖으로 밀려난다.
     * 시뮬레이션 화면에서만 그 효과를 걷어낸다.
     */
    const viewHost = root.closest<HTMLElement>('.view-enter');
    viewHost?.classList.add('barn-view-host');

    const q = <T extends HTMLElement = HTMLElement>(id: string) =>
      root.querySelector<T>('#bm-' + id);
    const canvas = q<HTMLCanvasElement>('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cvs = canvas;
    const c2d = ctx;

    const defaults: Omit<BarnData, 'id'> = {
      name: '우리 목장 · 측정동',
      length: 30,
      width: 22,
      x: 0,
      y: 0,
      turn: 0,
      height: 4,
      passage: 'none',
      alley: 3,
      a: 180,
      b: 300,
      z: 1.2,
      ax: 10,
      ay: 50,
      bx: 90,
      by: 50,
      mix: 50,
      day: 0,
      mass: 500,
      // 목장별 월 소요량이 하나라도 있으면 그 값, 없으면 0(미입력)
      demand: Object.values(settingsRef.current.sawdustMonthlyTonsByRanch ?? {}).find(v => v > 0) ?? 0,
      price: settingsRef.current.sawdustPricePerTon,
    };

    let barns: BarnData[] = [{ ...defaults, id: 1 }];
    let selected = 1;
    let nextId = 2;
    let yaw = 35;
    let pointer: number | null = null;
    let px = 0;

    /*
     * 3D 화면에서 축사를 직접 옮기고 크기를 바꾼다.
     * 화면은 모든 축사가 들어오도록 자동으로 확대·축소되는데, 끄는 동안 그 비율이 바뀌면
     * 손가락 아래에서 축사가 미끄러지므로 끄는 동안에는 마지막 비율을 고정한다.
     */
    type ViewFit = { cx: number; cy: number; scale: number };
    let lastFit: ViewFit | null = null;
    let lockedFit: ViewFit | null = null;
    type GripKind = 'length' | 'width' | 'corner' | 'height';
    let grips: { kind: GripKind; x: number; y: number }[] = [];
    type DragMode =
      | { mode: 'view' }
      | { mode: 'move'; offX: number; offY: number }
      | { mode: GripKind; startHeight: number; startY: number };
    let drag: DragMode | null = null;
    let frame = 0;
    let activePart = 'barn';
    let sensorIndex = 0;

    function getSensors(b: BarnData): BarnSensor[] {
      if (!b.sensors) {
        b.sensors = [
          { name: 'A', x: 10, y: 50, z: 1.2, value: 180 },
          { name: 'B', x: 90, y: 50, z: 1.2, value: 300 },
        ];
      }
      return b.sensors;
    }

    const scene = canvas.closest('.panel') as HTMLDivElement;
    const originalPanels = Array.from(root.children).filter(
      e => e.classList.contains('panel') && e.tagName === 'DIV'
    ) as HTMLDivElement[];

    const editor = document.createElement('div');
    editor.className = 'editor-layout';
    if (originalPanels[0]) {
      root.insertBefore(editor, originalPanels[0]);
    }
    if (scene) {
      editor.append(scene);
    }

    const inspector = document.createElement('section');
    inspector.className = 'panel inspector';
    inspector.innerHTML =
      '<div class="mobile-sheet-handle"></div><button type="button" class="sheet-close" id="bm-sheet-close" aria-label="설정 닫기">✕</button><h3 id="bm-inspector-title">축사 설정</h3><div class="object-tabs" id="bm-tabs"></div><p class="muted">3D 선택 지점을 누르면 설정이 열립니다.</p><div id="bm-inspector-fields"></div>';
    editor.append(inspector);

    const groups: Record<string, string[]> = {
      barn: ['name', 'length', 'width', 'x', 'y', 'turn', 'height'],
      a: ['a', 'ax', 'ay', 'z'],
      b: ['b', 'bx', 'by'],
      passage: ['passage', 'alley'],
      bedding: ['mix', 'day', 'mass', 'demand', 'price'],
    };

    const titles: Record<string, string> = {
      barn: '축사 · 크기와 배치',
      a: '센서 · 수치와 위치',
      b: 'B · 끝쪽 센서',
      passage: '급이·이동 통로',
      bedding: '도포 · 시간 · 비용',
    };

    const containers: Record<string, HTMLDivElement> = {};
    const tabsContainer = q<HTMLDivElement>('tabs')!;
    const inspectorFields = q<HTMLDivElement>('inspector-fields')!;

    for (const [key, keys] of Object.entries(groups)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cursor-interaction';
      btn.textContent = { barn: '축사', a: '센서', b: 'B', passage: '통로', bedding: '도포' }[key] || key;
      btn.dataset.part = key;
      if (key === 'b') btn.hidden = true;
      tabsContainer.append(btn);

      const div = document.createElement('div');
      div.className = 'fields';
      div.dataset.group = key;
      keys.forEach(k => {
        const el = q(k);
        const label = el?.closest('label');
        if (label) div.append(label);
      });
      inspectorFields.append(div);
      containers[key] = div;
      btn.addEventListener('click', () => selectPart(key));
    }

    containers.a.innerHTML =
      '<label>센서 선택<select id="bm-sensor-pick"></select></label><div class="bar" style="margin-bottom:8px"><button id="bm-sensor-add" type="button">＋ 추가</button><button id="bm-sensor-remove" type="button">삭제</button></div><label>예시 측정값 (희석배수)<input id="bm-sensor-value" type="number" min="0" max="1000" step="0.1"></label><label>높이 (m)<input id="bm-sensor-z" type="number" min="0" max="12" step="0.1"></label><label>앞→뒤 위치 (%)<input id="bm-sensor-x" type="range" min="0" max="100"></label><label>좌→우 위치 (%)<input id="bm-sensor-y" type="range" min="0" max="100"></label><span id="bm-sensor-position" class="muted text-xs"></span>';

    function sensorForm() {
      const b = current();
      const list = getSensors(b);
      sensorIndex = Math.min(sensorIndex, list.length - 1);
      const pick = q<HTMLSelectElement>('sensor-pick');
      if (pick) {
        pick.replaceChildren(
          ...list.map((s, i) => {
            const o = document.createElement('option');
            o.value = String(i);
            o.textContent = s.name;
            return o;
          })
        );
        pick.value = String(sensorIndex);
      }
      const s = list[sensorIndex];
      if (s) {
        for (const k of ['value', 'z', 'x', 'y'] as const) {
          const input = q<HTMLInputElement>('sensor-' + k);
          if (input) input.value = String(s[k]);
        }
      }
      const btnRemove = q<HTMLButtonElement>('sensor-remove');
      const btnAdd = q<HTMLButtonElement>('sensor-add');
      if (btnRemove) btnRemove.disabled = list.length <= 1;
      if (btnAdd) btnAdd.disabled = list.length >= 8;
    }

    q('sensor-pick')?.addEventListener('change', () => {
      const pick = q<HTMLSelectElement>('sensor-pick');
      if (pick) {
        sensorIndex = Number(pick.value);
        sensorForm();
        requestDraw();
      }
    });

    q('sensor-add')?.addEventListener('click', () => {
      const list = getSensors(current());
      if (list.length >= 8) return;
      let i = 1;
      while (list.some(s => s.name === 'S' + i)) i++;
      list.push({ name: 'S' + i, x: 50, y: 25, z: 1.2, value: 240 });
      sensorIndex = list.length - 1;
      sensorForm();
      requestDraw();
      updateSummary();
    });

    q('sensor-remove')?.addEventListener('click', () => {
      const list = getSensors(current());
      if (list.length <= 1) return;
      list.splice(sensorIndex, 1);
      sensorForm();
      requestDraw();
      updateSummary();
    });

    for (const key of ['value', 'z', 'x', 'y'] as const) {
      q('sensor-' + key)?.addEventListener('input', (e: Event) => {
        const target = e.target as HTMLInputElement;
        const errEl = q('error');
        if (target.value === '' || !target.checkValidity()) {
          if (errEl) errEl.textContent = '센서 입력 범위를 확인해 주세요.';
          return;
        }
        if (key === 'z' && Number(target.value) > current().height) {
          if (errEl) errEl.textContent = '센서 높이는 처마 높이 이하로 입력해 주세요.';
          return;
        }
        getSensors(current())[sensorIndex][key] = Number(target.value);
        if (errEl) errEl.textContent = '';
        requestDraw();
      });
    }

    const toolbar = originalPanels[0]?.querySelector('.bar');
    if (toolbar) {
      toolbar.classList.add('barn-toolbar');
      root.insertBefore(toolbar, editor);
    }
    const caveat = originalPanels[0]?.querySelector('p');
    if (caveat) {
      caveat.classList.add('barn-caveat');
      root.insertBefore(caveat, editor);
    }
    originalPanels.filter(p => p !== scene).forEach(p => p.remove());

    // 핫스팟 오버레이 생성
    const overlay = document.createElement('div');
    overlay.className = 'hotspots';
    canvas.parentNode?.append(overlay);
    const hotButtons = new Map<string, HTMLButtonElement>();

    canvas.parentNode?.addEventListener('pointermove', (e: Event) => {
      const pe = e as PointerEvent;
      if (pe.pointerType === 'touch') return;
      const r = canvas.getBoundingClientRect();
      const x = pe.clientX - r.left;
      const y = pe.clientY - r.top;
      let nearest: HTMLButtonElement | null = null;
      let distance = 65;
      hotButtons.forEach(btn => {
        const d = Math.hypot(parseFloat(btn.style.left) - x, parseFloat(btn.style.top) - y);
        if (d < distance) {
          distance = d;
          nearest = btn;
        }
      });
      hotButtons.forEach(btn => btn.classList.toggle('near', btn === nearest));
    });

    canvas.parentNode?.addEventListener('pointerleave', () => {
      hotButtons.forEach(btn => btn.classList.remove('near'));
    });

    const isMobile = () => window.matchMedia('(max-width:900px)').matches;

    function selectPart(part: string, id = selected) {
      if (part === 'b') part = 'a';
      activePart = part;
      // 축사를 끌어 옮길 때는 위아래로 움직여도 페이지가 스크롤되지 않게 한다
      cvs.style.touchAction = part === 'barn' ? 'none' : '';
      if (id !== selected) {
        selected = id;
        load();
      }
      Object.entries(containers).forEach(([k, v]) => {
        const isCurrent = k === part;
        v.hidden = !isCurrent;
        v.style.display = isCurrent ? 'grid' : 'none';
      });
      if (part === 'a') sensorForm();
      const titleEl = q('inspector-title');
      if (titleEl) titleEl.textContent = titles[part] || '설정';
      q('tabs')?.querySelectorAll('button').forEach(t => {
        t.setAttribute('aria-pressed', String(t.dataset.part === part));
      });
      requestDraw();
    }

    function hotspot(key: string, text: string, x: number, y: number, part: string, id: number) {
      let btn = hotButtons.get(key);
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cursor-interaction';
        overlay.append(btn);
        hotButtons.set(key, btn);
      }
      btn.textContent = text;
      btn.setAttribute('aria-label', text + ' 설정 열기');
      btn.setAttribute('aria-pressed', String(selected === id && activePart === part));
      btn.style.left = Math.max(42, Math.min(cvs.clientWidth - 42, x)) + 'px';
      btn.style.top = Math.max(20, Math.min(cvs.clientHeight - 20, y)) + 'px';
      btn.onclick = () => {
        selectPart(part, id);
        // 휴대폰에서는 설정 칸이 화면 아래 숨어 있으므로 눌린 지점의 설정을 팝업으로 띄운다
        if (isMobile()) setSheet(true);
      };
      btn.dataset.live = '1';
    }

    const current = () => barns.find(b => b.id === selected) || barns[0];

    function menu() {
      const sel = q<HTMLSelectElement>('select');
      if (sel) {
        sel.replaceChildren(
          ...barns.map(b => {
            const o = document.createElement('option');
            o.value = String(b.id);
            o.textContent = b.name;
            return o;
          })
        );
        sel.value = String(selected);
      }
      const rem = q<HTMLButtonElement>('remove');
      if (rem) rem.classList.toggle('is-locked', barns.length === 1);
    }

    const fields: (keyof BarnData)[] = [
      'name',
      'length',
      'width',
      'x',
      'y',
      'turn',
      'height',
      'passage',
      'alley',
      'a',
      'b',
      'z',
      'ax',
      'ay',
      'bx',
      'by',
      'mix',
      'day',
      'mass',
      'demand',
      'price',
    ];

    function load() {
      const b = current();
      fields.forEach(k => {
        const el = q<HTMLInputElement | HTMLSelectElement>(k);
        if (el && b[k] !== undefined) el.value = String(b[k]);
      });
      menu();
      sensorForm();
      draw();
      updateSummary();
    }

    // 히트맵 텍스처 보관함 — draw 바깥에 두어 프레임마다 살아남는다
    const TEXTURE_W = 160;
    const TEXTURE_H = 100;
    let textureCanvas: HTMLCanvasElement | null = null;
    let textureCacheKey = '';

    function requestDraw() {
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          draw();
        });
      }
    }

    /*
     * CSS 변수 색을 읽으려고 매번 임시 요소를 붙였다 떼면 그때마다 스타일 계산이 다시 돌아
     * 시점을 돌릴 때 눈에 띄게 끊긴다. 한 번 읽은 값은 담아 두고 테마가 바뀔 때만 비운다.
     */
    const colorCache = new Map<string, string>();

    function color(v: string) {
      const cached = colorCache.get(v);
      if (cached !== undefined) return cached;
      const e = document.createElement('span');
      e.style.color = v;
      root!.append(e);
      const out = getComputedStyle(e).color;
      e.remove();
      colorCache.set(v, out);
      return out;
    }

    function world(b: BarnData, x: number, y: number, z = 0): [number, number, number] {
      const t = (b.turn * Math.PI) / 180;
      return [
        b.x + x * Math.cos(t) - y * Math.sin(t),
        b.y + x * Math.sin(t) + y * Math.cos(t),
        z,
      ];
    }

    const snap = (v: number, step = 0.5) => Math.round(v / step) * step;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    /** 화면의 점 → 바닥(높이 0)의 좌표(m). 그리기와 같은 투영을 거꾸로 푼다 */
    function toGround(sx: number, sy: number): [number, number] | null {
      const f = lockedFit ?? lastFit;
      if (!f) return null;
      const theta = (yaw * Math.PI) / 180;
      const u = (sx - cvs.clientWidth / 2) / f.scale + f.cx;
      const v = ((sy - cvs.clientHeight / 2) / f.scale + f.cy) / 0.48;
      return [u * Math.cos(theta) + v * Math.sin(theta), -u * Math.sin(theta) + v * Math.cos(theta)];
    }

    /** 바닥 좌표 → 축사 안의 좌표 (앞→뒤, 좌→우) */
    function toLocal(b: BarnData, gx: number, gy: number): [number, number] {
      const t = (b.turn * Math.PI) / 180;
      const dx = gx - b.x;
      const dy = gy - b.y;
      return [dx * Math.cos(t) + dy * Math.sin(t), -dx * Math.sin(t) + dy * Math.cos(t)];
    }

    /** 누른 곳에 있는 축사 — 선택된 축사를 먼저 본다 */
    function barnAt(sx: number, sy: number): BarnData | null {
      const g = toGround(sx, sy);
      if (!g) return null;
      const order = [current(), ...barns.filter(t => t.id !== selected)];
      return (
        order.find(t => {
          const [lx, ly] = toLocal(t, g[0], g[1]);
          return lx >= 0 && lx <= t.length && ly >= 0 && ly <= t.width;
        }) ?? null
      );
    }



    /** 3D 화면에서 바꾼 값을 오른쪽 입력칸에도 보여 준다 */
    function syncBarnInputs() {
      const b = current();
      (['length', 'width', 'x', 'y', 'turn', 'height'] as const).forEach(k => {
        const el = q<HTMLInputElement | HTMLSelectElement>(k);
        if (el) el.value = String(b[k]);
      });
      const errEl = q('error');
      if (errEl) errEl.textContent = '';
    }

    function draw() {
      hotButtons.forEach(btn => (btn.dataset.live = '0'));
      const b = current();
      const W = cvs.clientWidth;
      const H = cvs.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      const bufferW = Math.round(W * dpr);
      const bufferH = Math.round(H * dpr);
      c2d.setTransform(1, 0, 0, 1, 0, 0);
      // 크기가 그대로면 화면만 지운다 — 매 프레임 width 를 다시 넣으면 버퍼를 새로 잡느라 느리다
      if (cvs.width !== bufferW || cvs.height !== bufferH) {
        cvs.width = bufferW;
        cvs.height = bufferH;
      } else {
        c2d.clearRect(0, 0, bufferW, bufferH);
      }
      c2d.scale(dpr, dpr);

      const ink = color('var(--ink)');
      const panel = color('var(--panel)');
      const line = color('var(--line)');
      const pass = color('var(--pass)');
      const theta = (yaw * Math.PI) / 180;

      const raw = (p: [number, number, number]): [number, number] => [
        p[0] * Math.cos(theta) - p[1] * Math.sin(theta),
        (p[0] * Math.sin(theta) + p[1] * Math.cos(theta)) * 0.48 - p[2],
      ];

      const corners = barns.flatMap(t =>
        [0, t.length].flatMap(x =>
          [0, t.width].flatMap(y => [0, t.height + 2].map(z => raw(world(t, x, y, z))))
        )
      );
      const xs = corners.map(p => p[0]);
      const ys = corners.map(p => p[1]);
      const xmin = Math.min(...xs);
      const xmax = Math.max(...xs);
      const ymin = Math.min(...ys);
      const ymax = Math.max(...ys);
      const fit: ViewFit = lockedFit ?? {
        cx: (xmin + xmax) / 2,
        cy: (ymin + ymax) / 2,
        scale: Math.min((W - 64) / (xmax - xmin || 1), (H - 72) / (ymax - ymin || 1)),
      };
      lastFit = fit;

      const P = (t: BarnData, x: number, y: number, z = 0): [number, number] => {
        const a = raw(world(t, x, y, z));
        return [W / 2 + (a[0] - fit.cx) * fit.scale, H / 2 + (a[1] - fit.cy) * fit.scale];
      };

      for (const t of barns) {
        const p = P(t, t.length / 2, t.width / 2, t.height + 2);
        hotspot('barn-' + t.id, t.id === selected ? '축사 설정' : t.name, p[0], p[1] - 16, 'barn', t.id);
      }

      function path(t: BarnData, ps: [number, number, number?][]) {
        c2d.beginPath();
        ps.forEach((p, i) => {
          const a = P(t, p[0], p[1], p[2] ?? 0);
          if (i) c2d.lineTo(a[0], a[1]);
          else c2d.moveTo(a[0], a[1]);
        });
      }

      function stroke(t: BarnData, ps: [number, number, number?][], col = line, dash: number[] = [], width = 1) {
        c2d.save();
        path(t, ps);
        c2d.strokeStyle = col;
        c2d.lineWidth = width;
        c2d.setLineDash(dash);
        c2d.stroke();
        c2d.restore();
      }

      const series: Record<number, number[]> = {
        25: [25, 82.5, 47.5],
        50: [275, 225, 85],
        75: [400, 147.5, 175],
      };
      const s = series[b.mix] || series[50];
      const v =
        b.day <= 7
          ? s[0] + ((s[1] - s[0]) * b.day) / 7
          : s[1] + ((s[2] - s[1]) * (b.day - 7)) / 23;
      const factor = s[0] ? v / s[0] : 1;

      const sensorList = getSensors(b);

      function field(x: number, y: number): number {
        let total = 0;
        let weights = 0;
        for (const sen of sensorList) {
          const d = (x - (b.length * sen.x) / 100) ** 2 + (y - (b.width * sen.y) / 100) ** 2;
          if (d < 0.00001) return sen.value * factor;
          const w = 1 / d;
          total += sen.value * w;
          weights += w;
        }
        return weights ? (total / weights) * factor : 0;
      }

      function isPass(y: number): boolean {
        return b.passage === 'center'
          ? Math.abs(y - b.width / 2) < b.alley / 2
          : b.passage === 'left'
          ? y < b.alley
          : b.passage === 'right'
          ? y > b.width - b.alley
          : false;
      }

      const palette = [
        [23, 109, 221],
        [0, 188, 212],
        [78, 203, 82],
        [239, 223, 53],
        [255, 138, 37],
        [223, 48, 44],
      ];

      const heat = (val: number, alpha = 1) => {
        const t = Math.max(0, Math.min(5, val / 80));
        const i = Math.min(4, Math.floor(t));
        const f = t - i;
        const c1 = palette[i];
        const c2 = palette[i + 1];
        const r = Math.round(c1[0] + (c2[0] - c1[0]) * f);
        const g = Math.round(c1[1] + (c2[1] - c1[1]) * f);
        const bl = Math.round(c1[2] + (c2[2] - c1[2]) * f);
        return `rgba(${r},${g},${bl},${alpha})`;
      };

      /*
       * 텍스처 히트맵 — 16,000 칸을 채우는 가장 무거운 일이라 매 프레임 다시 만들지 않는다.
       * 시점을 돌리거나 창 크기가 바뀌어도 값은 그대로이므로, 축사 크기·통로·센서·도포 조건이
       * 바뀔 때만 다시 계산한다.
       */
      const textureKey = JSON.stringify([
        b.length,
        b.width,
        b.passage,
        b.alley,
        factor,
        sensorList.map(sen => [sen.x, sen.y, sen.value]),
      ]);

      if (!textureCanvas) {
        textureCanvas = document.createElement('canvas');
        textureCanvas.width = TEXTURE_W;
        textureCanvas.height = TEXTURE_H;
      }
      if (textureCacheKey !== textureKey) {
        const tc = textureCanvas.getContext('2d')!;
        const im = tc.createImageData(TEXTURE_W, TEXTURE_H);

        for (let j = 0; j < TEXTURE_H; j++) {
          for (let i = 0; i < TEXTURE_W; i++) {
            const x = ((i + 0.5) * b.length) / TEXTURE_W;
            const y = ((j + 0.5) * b.width) / TEXTURE_H;
            const t = Math.max(0, Math.min(5, field(x, y) / 80));
            const k = Math.min(4, Math.floor(t));
            const f = t - k;
            const idx = (j * TEXTURE_W + i) * 4;
            for (let n = 0; n < 3; n++) {
              im.data[idx + n] = palette[k][n] + (palette[k + 1][n] - palette[k][n]) * f;
            }
            im.data[idx + 3] = isPass(y) ? 45 : 205;
          }
        }
        tc.putImageData(im, 0, 0);
        textureCacheKey = textureKey;
      }
      const texture = textureCanvas;

      const o = P(b, 0, 0, 0.05);
      const u = P(b, b.length, 0, 0.05);
      const vv = P(b, 0, b.width, 0.05);
      c2d.save();
      c2d.transform(
        (u[0] - o[0]) / TEXTURE_W,
        (u[1] - o[1]) / TEXTURE_W,
        (vv[0] - o[0]) / TEXTURE_H,
        (vv[1] - o[1]) / TEXTURE_H,
        o[0],
        o[1]
      );
      c2d.drawImage(texture, 0, 0);
      c2d.restore();

      c2d.save();
      path(b, [
        [0, 0, 0.05],
        [b.length, 0, 0.05],
        [b.length, b.width, 0.05],
        [0, b.width, 0.05],
      ]);
      c2d.closePath();
      c2d.clip();
      for (const sen of sensorList) {
        const p = P(b, (b.length * sen.x) / 100, (b.width * sen.y) / 100, 0.05);
        const radius = Math.max(20, Math.min(W, H) * 0.27);
        const g = c2d.createRadialGradient(p[0], p[1], 0, p[0], p[1], radius);
        g.addColorStop(0, heat(sen.value * factor, 0.23));
        g.addColorStop(1, heat(sen.value * factor, 0));
        c2d.fillStyle = g;
        c2d.fillRect(0, 0, W, H);
      }
      c2d.restore();

      // 축사 와이어프레임 골조
      for (const t of barns) {
        c2d.globalAlpha = t.id === selected ? 0.7 : 0.3;
        stroke(t, [
          [0, 0],
          [t.length, 0],
          [t.length, t.width],
          [0, t.width],
          [0, 0],
        ]);
        const n = Math.ceil(t.length / 5);
        for (let i = 0; i <= n; i++) {
          const x = (t.length * i) / n;
          stroke(t, [
            [x, 0, 0],
            [x, 0, t.height],
            [x, t.width / 2, t.height + 2],
            [x, t.width, t.height],
            [x, t.width, 0],
          ]);
        }
        for (const [y, z] of [
          [0, t.height],
          [t.width / 2, t.height + 2],
          [t.width, t.height],
        ]) {
          stroke(t, [
            [0, y, z],
            [t.length, y, z],
          ]);
        }
        if (t.id !== selected) {
          const p = P(t, t.length / 2, t.width / 2);
          c2d.fillStyle = ink;
          c2d.textAlign = 'center';
          c2d.fillText(t.name, p[0], p[1]);
        }
      }
      c2d.globalAlpha = 1;

      // 통로
      if (b.passage !== 'none') {
        const lo = b.passage === 'left' ? 0 : b.passage === 'right' ? b.width - b.alley : (b.width - b.alley) / 2;
        for (const y of [lo, lo + b.alley]) {
          stroke(b, [[0, y, 0.1], [b.length, y, 0.1]], pass, [8, 6], 2.5);
        }
      }

      // 센서 포인트 표시
      c2d.font = '13px Pretendard, system-ui';
      c2d.textAlign = 'center';
      sensorList.forEach((sen, i) => {
        const x = (b.length * sen.x) / 100;
        const y = (b.width * sen.y) / 100;
        stroke(b, [[x, y, 0], [x, y, sen.z]], ink, [2, 3]);
        const p = P(b, x, y, sen.z);
        c2d.beginPath();
        c2d.arc(p[0], p[1], 6, 0, Math.PI * 2);
        c2d.fillStyle = panel;
        c2d.fill();
        c2d.strokeStyle = ink;
        c2d.lineWidth = 2;
        c2d.stroke();

        if (activePart === 'a' && i === sensorIndex) {
          c2d.beginPath();
          c2d.arc(p[0], p[1], 11, 0, Math.PI * 2);
          c2d.stroke();
        }

        const text = sen.name + ' · ' + (sen.value * factor).toFixed(1) + '배';
        const tw = c2d.measureText(text).width;
        const tx = Math.max(tw / 2 + 4, Math.min(W - tw / 2 - 4, p[0]));
        const ty = Math.max(18, p[1] - 16);
        c2d.fillStyle = panel;
        c2d.fillRect(tx - tw / 2 - 4, ty - 14, tw + 8, 20);
        c2d.fillStyle = ink;
        c2d.fillText(text, tx, ty);
      });

      const dimEl = q('dim');
      if (dimEl) dimEl.textContent = `${b.name} · ${b.length} × ${b.width}m · ${(b.length * b.width).toLocaleString()}㎡`;
      const dayLabelEl = q('day-label');
      if (dayLabelEl) dayLabelEl.textContent = b.day + '일';

      const statusEl = q('status');
      if (statusEl) {
        statusEl.textContent = `예시값 · 센서 ${sensorList.length}개 · ${b.day}일 가정 · ` +
          sensorList.map(sen => `${sen.name} ${sen.value.toFixed(1)} → ${(sen.value * factor).toFixed(1)}배`).join(' / ');
      }

      const editSensor = sensorList[Math.min(sensorIndex, sensorList.length - 1)];
      const sensorPosEl = q('sensor-position');
      if (sensorPosEl && editSensor) {
        sensorPosEl.textContent = `앞 ${((b.length * editSensor.x) / 100).toFixed(1)}m · 옆 ${((b.width * editSensor.y) / 100).toFixed(1)}m`;
      }

      const savingEl = q('saving');
      if (savingEl) {
        const saved = sawdustSavingFromAmounts({ monthlyTons: b.demand, coffeeKg: b.mass, pricePerTon: b.price });
        savingEl.textContent = saved
          ? '예상 톱밥 구매 절감 ' + saved.savingKrw.toLocaleString('ko-KR') + '원 · 줄어든 톱밥 ' +
            saved.savedTons.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + '톤 (선택 동 커피박 ' + b.mass.toLocaleString() + 'kg)'
          : '톱밥 절감은 월 톱밥 소요량을 넣으면 계산합니다';
      }

      const codeEl = q('code');
      if (codeEl) {
        codeEl.textContent = JSON.stringify(
          {
            schema: 'barn-module-v2',
            units: 'm',
            barns: barns.map(t => ({
              id: t.id,
              name: t.name,
              size: { length: t.length, width: t.width, eaveHeight: t.height },
              placement: { x: t.x, y: t.y, rotation: t.turn },
              passage: { position: t.passage, width: t.alley },
              sensors: getSensors(t).map(sen => ({
                id: sen.name,
                xRatio: sen.x / 100,
                yRatio: sen.y / 100,
                height: sen.z,
                exampleValue: sen.value,
              })),
              scenario: { day: t.day, mix: t.mix, mass: t.mass, sawdustMonthlyTons: t.demand, sawdustPricePerTon: t.price },
            })),
          },
          null,
          2
        );
      }

      grips = [];
      if (activePart === 'barn') {
        stroke(b, [[0, 0], [b.length, 0], [b.length, b.width], [0, b.width], [0, 0]], ink, [], 2.5);

        // 끌어서 크기·높이를 바꾸는 점 — 흰 점, 모서리는 네모
        const gripAt = (kind: GripKind, label: string, x: number, y: number, z: number) => {
          const p = P(b, x, y, z);
          grips.push({ kind, x: p[0], y: p[1] });
          c2d.beginPath();
          if (kind === 'corner') c2d.rect(p[0] - 7, p[1] - 7, 14, 14);
          else c2d.arc(p[0], p[1], 7, 0, Math.PI * 2);
          c2d.fillStyle = '#ffffff';
          c2d.fill();
          c2d.strokeStyle = ink;
          c2d.lineWidth = 2;
          c2d.stroke();
          c2d.font = '600 11px Pretendard, system-ui';
          c2d.fillStyle = ink;
          c2d.textAlign = 'left';
          c2d.fillText(label, p[0] + 11, p[1] + 4);
        };
        stroke(b, [[0, b.width / 2, b.height + 2], [0, b.width / 2, 0]], ink, [3, 4]);
        gripAt('length', '길이', b.length, b.width / 2, 0);
        gripAt('width', '폭', b.length / 2, b.width, 0);
        gripAt('corner', '크기', b.length, b.width, 0);
        gripAt('height', '높이', 0, b.width / 2, b.height + 2);
      }

      // 흰 조절점 바로 위에 뜬 설정 버튼은 잠시 숨겨, 조절점을 누를 수 있게 한다
      hotButtons.forEach((btn, key) => {
        const blocking =
          key !== 'rotate' &&
          grips.some(g => Math.hypot(g.x - parseFloat(btn.style.left), g.y - parseFloat(btn.style.top)) < 34);
        btn.style.visibility = blocking ? 'hidden' : '';
      });

      hotButtons.forEach((btn, key) => {
        if (btn.dataset.live !== '1') {
          btn.remove();
          hotButtons.delete(key);
        }
      });
    }

    // 결과 요약 카드 연산 함수
    function calcFactor() {
      const mix = Number((q<HTMLSelectElement>('mix')?.value) || 50);
      const day = Number((q<HTMLInputElement>('day')?.value) || 0);
      const seriesMap: Record<number, number[]> = {
        25: [25, 82.5, 47.5],
        50: [275, 225, 85],
        75: [400, 147.5, 175],
      };
      const s = seriesMap[mix] || seriesMap[50];
      const v = day <= 7 ? s[0] + ((s[1] - s[0]) * day) / 7 : s[1] + ((s[2] - s[1]) * (day - 7)) / 23;
      return s[0] ? v / s[0] : 1;
    }

    function updateSummary() {
      const factor = calcFactor();
      const change = (factor - 1) * 100;
      const mass = Number(q<HTMLInputElement>('mass')?.value || 0);
      const demand = Number(q<HTMLInputElement>('demand')?.value || 0);
      const price = Number(q<HTMLInputElement>('price')?.value || 0);
      const saved = sawdustSavingFromAmounts({ monthlyTons: demand, coffeeKg: mass, pricePerTon: price });
      const day = Number(q<HTMLInputElement>('day')?.value || 0);
      const mix = Number(q<HTMLSelectElement>('mix')?.value || 50);
      const length = Number(q<HTMLInputElement>('length')?.value || 0);
      const width = Number(q<HTMLInputElement>('width')?.value || 0);
      const sensorCount = q<HTMLSelectElement>('sensor-pick')?.options.length || 0;

      const odorEl = root!.querySelector<HTMLElement>('#apple-odor');
      if (odorEl) {
        odorEl.textContent = (change > 0 ? '+' : '') + change.toFixed(0) + '%';
        odorEl.style.color = change <= 0 ? 'var(--brand)' : 'var(--warn)';
      }
      const odorNoteEl = root!.querySelector<HTMLElement>('#apple-odor-note');
      if (odorNoteEl) {
        odorNoteEl.textContent = change <= 0 ? '초기값 대비 예상 감소' : '초기값 대비 예상 증가';
      }
      const savingValEl = root!.querySelector<HTMLElement>('#apple-saving');
      if (savingValEl) savingValEl.textContent = saved ? saved.savingKrw.toLocaleString('ko-KR') + '원' : '소요량 입력 필요';
      const savingNoteEl = root!.querySelector<HTMLElement>('#apple-saving-note');
      if (savingNoteEl) {
        savingNoteEl.textContent = saved
          ? `줄어든 톱밥 ${saved.savedTons.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}톤 · ${saved.limitedBy === 'coffee' ? '커피박 사용량 한도' : '소요량 50% 한도'}`
          : '톱밥 비용 가정에서 월 소요량 입력';
      }
      const dayValEl = root!.querySelector<HTMLElement>('#apple-day');
      if (dayValEl) dayValEl.textContent = day + '일';
      const mixNoteEl = root!.querySelector<HTMLElement>('#apple-mix-note');
      if (mixNoteEl) mixNoteEl.textContent = '혼합비 ' + mix + '%';
      const massValEl = root!.querySelector<HTMLElement>('#apple-mass');
      if (massValEl) massValEl.textContent = mass.toLocaleString('ko-KR') + ' kg';
      const sizeValEl = root!.querySelector<HTMLElement>('#apple-size');
      if (sizeValEl) sizeValEl.textContent = length + ' × ' + width + 'm';
      const sensorsValEl = root!.querySelector<HTMLElement>('#apple-sensors');
      if (sensorsValEl) sensorsValEl.textContent = sensorCount + '개';

      const selEl = q<HTMLSelectElement>('select');
      const name = selEl?.selectedOptions?.[0]?.textContent || q<HTMLInputElement>('name')?.value || '현재 축사';
      const subtitleEl = root!.querySelector<HTMLElement>('#apple-barn-subtitle');
      if (subtitleEl) subtitleEl.textContent = name;
    }

    // 입력 폼 이벤트 리스너
    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const key = target.id?.replace('bm-', '') as keyof BarnData;
      if (!fields.includes(key)) return;

      const bad = fields.some(k => {
        const el = q<HTMLInputElement>(k);
        return el && el.type === 'number' && (el.value === '' || !el.checkValidity());
      });
      const errEl = q('error');
      if (bad) {
        if (errEl) errEl.textContent = '숫자 입력 범위를 확인해 주세요.';
        return;
      }
      const b = current();
      const draft: any = { ...b };
      fields.forEach(k => {
        const el = q<HTMLInputElement | HTMLSelectElement>(k);
        if (el) draft[k] = ['name', 'passage'].includes(k) ? el.value : Number(el.value);
      });
      if (draft.alley >= draft.width && draft.passage !== 'none') {
        if (errEl) errEl.textContent = '통로 폭은 축사 폭보다 작아야 합니다.';
        return;
      }
      if (draft.z > draft.height) {
        if (errEl) errEl.textContent = '센서 높이는 처마 높이 이하로 입력해 주세요.';
        return;
      }
      Object.assign(b, draft);
      if (errEl) errEl.textContent = '';
      if (key === 'name') menu();
      requestDraw();
      updateSummary();
    };

    root.addEventListener('input', handleInput);

    q('select')?.addEventListener('change', () => {
      const sel = q<HTMLSelectElement>('select');
      if (sel) {
        selected = Number(sel.value);
        const errEl = q('error');
        if (errEl) errEl.textContent = '';
        load();
      }
    });

    q('add')?.addEventListener('click', () => {
      selected = nextId++;
      barns.push({
        ...defaults,
        id: selected,
        name: '축사 ' + selected,
        x: Math.max(...barns.map(t => t.x + t.length)) + 10,
      });
      load();
    });

    removeBarnRef.current = (id: number) => {
      if (barns.length === 1) return;
      barns = barns.filter(t => t.id !== id);
      selected = barns[0].id;
      load();
    };

    q('remove')?.addEventListener('click', () => {
      const target = barns.find(t => t.id === selected);
      handlersRef.current.setDeleteTarget({
        id: selected,
        name: target?.name || '축사',
        onlyOne: barns.length === 1,
      });
    });

    q('left')?.addEventListener('click', () => {
      yaw -= 10;
      requestDraw();
    });

    q('right')?.addEventListener('click', () => {
      yaw += 10;
      requestDraw();
    });

    // 3D 화면 끌기 — 조절점: 크기·높이 / 축사 바닥: 이동 / 빈 곳: 시점 회전
    const localPoint = (e: PointerEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };

    const gripNear = (sx: number, sy: number, tolerance: number) =>
      activePart === 'barn' ? grips.find(g => Math.hypot(g.x - sx, g.y - sy) <= tolerance) : undefined;

    const GRIP_CURSOR: Record<GripKind, string> = {
      length: 'ew-resize',
      width: 'ns-resize',
      corner: 'nwse-resize',
      height: 'ns-resize',
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (pointer !== null || e.button !== 0) return;
      const [sx, sy] = localPoint(e);
      const tolerance = e.pointerType === 'touch' ? 26 : 14;
      let next: DragMode = { mode: 'view' };

      const grip = gripNear(sx, sy, tolerance);
      if (grip) {
        next = { mode: grip.kind, startHeight: current().height, startY: sy };
      } else {
        const hit = barnAt(sx, sy);
        // 다른 축사를 누르면 그 축사로, 축사 탭에서 선택 축사를 누르면 옮기기
        if (hit && (activePart === 'barn' || hit.id !== selected)) {
          if (hit.id !== selected || activePart !== 'barn') selectPart('barn', hit.id);
          const g = toGround(sx, sy);
          if (g) next = { mode: 'move', offX: g[0] - hit.x, offY: g[1] - hit.y };
        }
      }

      drag = next;
      if (next.mode !== 'view') lockedFit = lastFit;
      pointer = e.pointerId;
      px = e.clientX;
      canvas.setPointerCapture(pointer);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const [sx, sy] = localPoint(e);

      // 마우스를 올려 두기만 했을 때 — 무엇을 끌 수 있는지 커서로 알려 준다
      if (pointer === null) {
        if (e.pointerType !== 'mouse') return;
        const grip = gripNear(sx, sy, 14);
        const hit = grip ? null : barnAt(sx, sy);
        canvas.style.cursor = grip
          ? GRIP_CURSOR[grip.kind]
          : hit && (activePart === 'barn' || hit.id !== selected)
            ? activePart === 'barn' && hit.id === selected
              ? 'move'
              : 'pointer'
            : 'grab';
        return;
      }
      if (e.pointerId !== pointer || !drag) return;

      if (drag.mode === 'view') {
        yaw += (e.clientX - px) * 0.35;
        px = e.clientX;
        requestDraw();
        return;
      }

      const b = current();
      const g = toGround(sx, sy);
      if (!g) return;

      if (drag.mode === 'move') {
        b.x = clamp(snap(g[0] - drag.offX), -200, 200);
        b.y = clamp(snap(g[1] - drag.offY), -200, 200);
      } else if (drag.mode === 'height') {
        const f = lockedFit ?? lastFit;
        const tallest = Math.max(0, ...getSensors(b).map(sen => sen.z));
        if (f) b.height = clamp(snap(drag.startHeight + (drag.startY - sy) / f.scale), Math.max(2, tallest), 12);
      } else {
        const [lx, ly] = toLocal(b, g[0], g[1]);
        // 통로가 있으면 폭이 통로보다 넓어야 한다
        const minWidth = b.passage === 'none' ? 3 : Math.max(3, b.alley + 0.5);
        if (drag.mode !== 'width') b.length = clamp(snap(lx), 5, 150);
        if (drag.mode !== 'length') b.width = clamp(snap(ly), minWidth, 80);
      }

      syncBarnInputs();
      updateSummary();
      requestDraw();
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      const wasEditing = drag && drag.mode !== 'view';
      drag = null;
      if (wasEditing) {
        // 손을 떼면 모든 축사가 보이도록 다시 맞춘다
        lockedFit = null;
        requestDraw();
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
    canvas.addEventListener('lostpointercapture', handlePointerUp);

    // 모바일 바텀시트
    const overlaySheet = document.createElement('div');
    overlaySheet.className = 'apple-mobile-overlay';
    document.body.append(overlaySheet);

    /*
     * 휴대폰 설정 창은 세 가지 높이를 가진다.
     *  - closed: 내려가 있다
     *  - peek  : 화면 아래 절반만 차지한다. 값을 고치는 동안 위쪽 3D가 그대로 보여야 하므로
     *            뒤를 어둡게 덮지 않고 뒤 화면 스크롤도 막지 않는다.
     *  - full  : 설정 항목이 많을 때 손잡이를 위로 끌어 올린 상태. 이때만 덮개를 깐다.
     */
    type SheetState = 'closed' | 'peek' | 'full';
    let sheetState: SheetState = 'closed';

    const setSheetState = (next: SheetState) => {
      const opening = sheetState === 'closed' && next !== 'closed';
      sheetState = next;
      inspector.classList.toggle('sheet-open', next !== 'closed');
      inspector.classList.toggle('sheet-full', next === 'full');
      overlaySheet.classList.toggle('show', next === 'full');
      document.body.classList.toggle('barn-sheet-open', next === 'full');
      document.body.classList.toggle('barn-sheet-peek', next === 'peek');
      if (opening) {
        inspector.scrollTop = 0;
        // 값을 고치는 동안 3D 화면이 설정 창 위쪽에 보이도록 맞춘다
        if (isMobile()) scene?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    };

    const setSheet = (open: boolean) => setSheetState(open ? 'peek' : 'closed');

    inspector.querySelector('h3')?.addEventListener('click', () => {
      if (isMobile()) setSheet(sheetState === 'closed');
    });

    // 손잡이 — 위로 끌면 전체 높이, 아래로 끌면 반높이 → 닫힘, 톡 누르면 닫힘
    const handle = inspector.querySelector<HTMLElement>('.mobile-sheet-handle');
    if (handle) {
      const DRAG_THRESHOLD = 40;
      let dragging = false;
      let startY = 0;
      let movedY = 0;
      handle.addEventListener('pointerdown', e => {
        dragging = true;
        startY = e.clientY;
        movedY = 0;
        try {
          handle.setPointerCapture(e.pointerId);
        } catch {
          /* 포인터를 못 잡아도 아래 pointermove 로 따라간다 */
        }
      });
      handle.addEventListener('pointermove', e => {
        if (dragging) movedY = e.clientY - startY;
      });
      const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        if (movedY < -DRAG_THRESHOLD) setSheetState('full');
        else if (movedY > DRAG_THRESHOLD) setSheetState(sheetState === 'full' ? 'peek' : 'closed');
        else setSheetState('closed');
      };
      handle.addEventListener('pointerup', endDrag);
      handle.addEventListener('pointercancel', () => {
        dragging = false;
      });
    }

    inspector.querySelector('#bm-sheet-close')?.addEventListener('click', () => setSheet(false));
    overlaySheet.addEventListener('click', () => setSheet(false));

    // 가로로 돌리거나 큰 화면이 되면 팝업 상태를 풀어 준다 (옆 패널로 돌아간다)
    const wide = window.matchMedia('(min-width:901px)');
    const handleWide = () => {
      if (wide.matches) setSheet(false);
    };
    wide.addEventListener('change', handleWide);

    // 축사 설정 열기 버튼 연동
    root.querySelector('#bm-open-settings')?.addEventListener('click', () => {
      if (isMobile()) {
        setSheet(true);
      } else {
        inspector.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    // 근거 자료(i) 버튼 클릭 연동
    root.querySelectorAll<HTMLButtonElement>('.info-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        const key = btn.dataset.infoKey;
        if (key) {
          handlersRef.current.setSelectedInfoKey(key);
        }
      });
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSheet(false);
        handlersRef.current.setSelectedInfoKey(null);
        handlersRef.current.setDeleteTarget(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // 테마가 바뀌면 색만 다시 읽어 그린다 — 시뮬레이션 상태는 그대로 둔다
    const refreshTheme = () => {
      colorCache.clear();
      requestDraw();
    };
    redrawRef.current = refreshTheme;

    const resizeObserver = new ResizeObserver(() => {
      requestDraw();
    });
    resizeObserver.observe(canvas);

    // 초기 로딩
    selectPart('barn');
    load();

    return () => {
      resizeObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
      root.removeEventListener('input', handleInput);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
      canvas.removeEventListener('lostpointercapture', handlePointerUp);
      document.removeEventListener('keydown', handleKeyDown);
      wide.removeEventListener('change', handleWide);
      removeBarnRef.current = null;
      viewHost?.classList.remove('barn-view-host');
      document.body.classList.remove('barn-sheet-open');
      document.body.classList.remove('barn-sheet-peek');
      overlaySheet.remove();
      redrawRef.current = null;
    };
    // 한 번만 만들고 끝낸다. 콜백은 handlersRef, 테마는 아래 효과가 맡는다.
  }, []);

  // 앱 어디서 테마를 바꾸든 3D 장면 색을 맞춘다 (엔진을 다시 만들지 않는다)
  useEffect(() => {
    redrawRef.current?.();
  }, [theme]);

  return (
    <>
      <div id="barn-module" ref={containerRef}>
      {/* 상단 네비게이션 헤더: 박스형이 아닌 슬림한 인라인 헤더로 공간 최적화 */}
      <header className="apple-header">
        <div className="apple-header-left">
          <div className="apple-title-wrap">
            <div className="apple-title">축사 시뮬레이션</div>
            <div className="apple-subtitle" id="apple-barn-subtitle">
              현재 축사
            </div>
          </div>
        </div>
      </header>

      {/* 축사 선택 툴바 */}
      <div className="panel">
        <div className="bar">
          <label>
            편집할 축사
            <select id="bm-select"></select>
          </label>
          <button id="bm-add" className="cursor-interaction" type="button">
            축사 추가
          </button>
          <button id="bm-open-settings" className="cursor-interaction" type="button">
            ⚙ 축사 설정
          </button>
          <button id="bm-remove" className="cursor-interaction" type="button">
            <span className="barn-btn-long">선택 축사 </span>삭제
          </button>
        </div>
        <div className="fields">
          <label>
            축사 이름
            <input id="bm-name" defaultValue="우리 목장 · 측정동" />
          </label>
          <label>
            길이 · 앞→뒤 (m)
            <input id="bm-length" type="number" min="5" max="150" step="0.5" defaultValue="30" />
          </label>
          <label>
            폭 (m)
            <input id="bm-width" type="number" min="3" max="80" step="0.5" defaultValue="22" />
          </label>
        </div>
        <details>
          <summary className="cursor-interaction">동 배치 · 높이 · 통로 조절</summary>
          <div className="fields">
            <label>
              배치 X (m)
              <input id="bm-x" type="number" min="-200" max="200" step="0.5" defaultValue="0" />
            </label>
            <label>
              배치 Y (m)
              <input id="bm-y" type="number" min="-200" max="200" step="0.5" defaultValue="0" />
            </label>
            <label>
              동 방향
              <select id="bm-turn" defaultValue="0">
                <option value="0">0°</option>
                <option value="90">90°</option>
                <option value="180">180°</option>
                <option value="270">270°</option>
              </select>
            </label>
            <label>
              처마 높이 (m)
              <input id="bm-height" type="number" min="2" max="12" step="0.5" defaultValue="4" />
            </label>
            <label>
              통로 위치
              <select id="bm-passage" defaultValue="none">
                <option value="none">통로 없음</option>
                <option value="left">왼쪽</option>
                <option value="center">중앙</option>
                <option value="right">오른쪽</option>
              </select>
            </label>
            <label>
              통로 폭 (m)
              <input id="bm-alley" type="number" min="0.5" max="10" step="0.5" defaultValue="3" />
            </label>
          </div>
        </details>
      </div>

      {/* 3D 캔버스 뷰 */}
      <div className="panel">
        <div className="bar">
          <span id="bm-dim"></span>
          <div className="key">
            <span>
              <span className="swatch"></span>급이·이동 통로
            </span>
            <span>○ A 앞쪽 · □ B 끝쪽</span>
            <span className="muted">선택 동: 색상 / 다른 동: 골조</span>
          </div>
        </div>
        <div className="scene">
          <canvas id="bm-canvas" role="img" aria-label="선택한 독립 축사의 앞뒤 센서와 가상 악취 분포"></canvas>
        </div>
        <div className="bar">
          <span className="muted">축사를 끌어 옮기기 · 흰 점으로 크기·높이 · 빈 곳을 좌우로 끌어 시점 회전</span>
          <div>
            <button id="bm-left" type="button" aria-label="시점 왼쪽 회전">
              ↶
            </button>{' '}
            <button id="bm-right" type="button" aria-label="시점 오른쪽 회전">
              ↷
            </button>
          </div>
        </div>
        <div className="scale"></div>
        <div className="bar muted">
          <span>낮음 · 0배</span>
          <span>복합악취 희석배수 · 높음 400배+</span>
        </div>
        <div id="bm-status" className="status" aria-live="polite"></div>
        <div id="bm-error" className="error" role="alert"></div>
      </div>

      {/* 센서 설정 패널 */}
      <div className="panel">
        <h3>센서 설정</h3>
        <div className="fields">
          <label>
            A 앞쪽 · 희석배수 (배)
            <input id="bm-a" type="number" min="0" max="1000" defaultValue="180" />
          </label>
          <label>
            B 끝쪽 · 희석배수 (배)
            <input id="bm-b" type="number" min="0" max="1000" defaultValue="300" />
          </label>
          <label>
            센서 높이 (m)
            <input id="bm-z" type="number" min="0" max="3" step="0.1" defaultValue="1.2" />
          </label>
        </div>
        <details>
          <summary className="cursor-interaction">센서 배치 미세 조절</summary>
          <div className="fields">
            <label>
              A 길이 방향 (%)
              <input id="bm-ax" type="range" min="0" max="100" defaultValue="10" />
            </label>
            <label>
              A 폭 방향 (%)
              <input id="bm-ay" type="range" min="0" max="100" defaultValue="50" />
            </label>
            <span id="bm-apos"></span>
            <label>
              B 길이 방향 (%)
              <input id="bm-bx" type="range" min="0" max="100" defaultValue="90" />
            </label>
            <label>
              B 폭 방향 (%)
              <input id="bm-by" type="range" min="0" max="100" defaultValue="50" />
            </label>
            <span id="bm-bpos"></span>
          </div>
        </details>
      </div>

      {/* 도포 후 변화 패널 */}
      <div className="panel">
        <h3>선택한 동 · 도포 후 변화</h3>
        <div className="fields">
          <label>
            참고 연구 혼합비
            <select id="bm-mix" defaultValue="50">
              <option value="25">25%</option>
              <option value="50">50%</option>
              <option value="75">75%</option>
            </select>
          </label>
          <label>
            경과 일수 <output id="bm-day-label">0일</output>
            <input id="bm-day" type="range" min="0" max="30" defaultValue="0" />
          </label>
          <label>
            커피박 사용량 (kg)
            <input id="bm-mass" type="number" min="0" max="100000" defaultValue="500" />
          </label>
        </div>
        <p className="muted">
          시간 변화는 이전 한우 연구의 상대 변화율을 적용한 가정입니다. 도포량·축사 크기로 효과를 보정하지 않으며, 특정 목장의 예측값이 아닙니다.
        </p>
        <div id="bm-saving" className="status" aria-live="polite"></div>
        <details>
          <summary className="cursor-interaction">톱밥 비용 가정</summary>
          <div className="fields">
            <label>
              월 톱밥 소요량 (톤)
              <input id="bm-demand" type="number" min="0" max="10000" step="0.5" defaultValue="0" />
            </label>
            <label>
              톱밥 단가 (원/톤)
              <input id="bm-price" type="number" min="0" max="10000000" step="1000" defaultValue="120000" />
            </label>
          </div>
          <p className="muted">절감 = min(월 소요량 × 50%, 커피박 사용량) × 톤 단가 · 운송·처리비 차감 전 · 실제 구매 절감 보장 아님</p>
        </details>
      </div>

      {/* 결과 요약 카드 (Apple 스타일) */}
      <section className="apple-results">
        <div className="apple-section-title">
          <div className="flex items-center gap-1.5">
            <h3>시뮬레이션 결과</h3>
            <button
              type="button"
              className="info-btn"
              data-info-key="overview"
              title="산출 근거 종합 안내 보기"
              aria-label="산출 근거 종합 안내 보기"
            >
              i
            </button>
          </div>
          <span>연구 상대 변화율 기반 참고값</span>
        </div>
        <div className="result-grid">
          <article className="result-card primary">
            <div className="result-label flex items-center justify-between">
              <span>예상 악취 변화</span>
              <button
                type="button"
                className="info-btn"
                data-info-key="odor"
                title="예상 악취 변화 근거 자료 보기"
                aria-label="예상 악취 변화 근거 자료 보기"
              >
                i
              </button>
            </div>
            <div className="result-value" id="apple-odor">
              —
            </div>
            <div className="result-note" id="apple-odor-note">
              초기값 대비 상대 변화
            </div>
          </article>
          <article className="result-card">
            <div className="result-label flex items-center justify-between">
              <span>예상 톱밥 구매 절감</span>
              <button
                type="button"
                className="info-btn"
                data-info-key="saving"
                title="톱밥 구매 절감 근거 자료 보기"
                aria-label="톱밥 구매 절감 근거 자료 보기"
              >
                i
              </button>
            </div>
            <div className="result-value" id="apple-saving">
              —
            </div>
            <div className="result-note" id="apple-saving-note">
              톱밥 구매 50% 절감 가정
            </div>
          </article>
          <article className="result-card">
            <div className="result-label flex items-center justify-between">
              <span>경과</span>
              <button
                type="button"
                className="info-btn"
                data-info-key="cycle"
                title="경과 일수 및 혼합비 근거 자료 보기"
                aria-label="경과 일수 및 혼합비 근거 자료 보기"
              >
                i
              </button>
            </div>
            <div className="result-value" id="apple-day">
              0일
            </div>
            <div className="result-note" id="apple-mix-note">
              혼합비 50%
            </div>
          </article>
        </div>

        <div className="apple-condition-card">
          <div className="apple-section-title">
            <h3>현재 조건</h3>
            <span>값을 변경하면 결과가 즉시 갱신됩니다.</span>
          </div>
          <div className="condition-grid">
            <div className="condition-item">
              <div className="condition-label flex items-center justify-between">
                <span>커피박 사용량</span>
                <button
                  type="button"
                  className="info-btn"
                  data-info-key="mass"
                  title="커피박 사용량 산출 기준 보기"
                  aria-label="커피박 사용량 산출 기준 보기"
                >
                  i
                </button>
              </div>
              <div className="condition-value" id="apple-mass">
                500 kg
              </div>
            </div>
            <div className="condition-item">
              <div className="condition-label flex items-center justify-between">
                <span>축사 크기</span>
                <button
                  type="button"
                  className="info-btn"
                  data-info-key="size"
                  title="축사 규격 산출 기준 보기"
                  aria-label="축사 규격 산출 기준 보기"
                >
                  i
                </button>
              </div>
              <div className="condition-value" id="apple-size">
                30 × 22m
              </div>
            </div>
            <div className="condition-item">
              <div className="condition-label flex items-center justify-between">
                <span>센서</span>
                <button
                  type="button"
                  className="info-btn"
                  data-info-key="sensor"
                  title="센서 배치 및 공간 보간 근거 보기"
                  aria-label="센서 배치 및 공간 보간 근거 보기"
                >
                  i
                </button>
              </div>
              <div className="condition-value" id="apple-sensors">
                2개
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    {/* 축사 삭제 확인 — 누르는 즉시 지우지 않는다 */}
    {deleteTarget && (
      <div
        className="evidence-modal-overlay"
        onClick={() => setDeleteTarget(null)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="barn-delete-title"
      >
        <div className="evidence-modal-content" onClick={e => e.stopPropagation()}>
          <div className="evidence-modal-header">
            <div className="evidence-modal-title-wrap">
              <h4 id="barn-delete-title" className="evidence-modal-title">
                {deleteTarget.onlyOne ? '지울 수 없습니다' : '이 축사를 지울까요?'}
              </h4>
            </div>
            <button
              type="button"
              className="evidence-close-btn"
              onClick={() => setDeleteTarget(null)}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
          <div className="evidence-modal-body">
            <p>
              {deleteTarget.onlyOne
                ? '축사가 하나뿐이라 지울 수 없습니다. 먼저 [축사 추가]로 다른 동을 만든 뒤 지워 주세요.'
                : `‘${deleteTarget.name}’을 시뮬레이션 목록에서 지웁니다. 되돌릴 수 없습니다. 부숙 기록과 현장 점검 자료는 그대로 남습니다.`}
            </p>
          </div>
          <div className="barn-confirm-actions">
            {deleteTarget.onlyOne ? (
              <button type="button" onClick={() => setDeleteTarget(null)}>
                확인
              </button>
            ) : (
              <>
                <button type="button" onClick={() => setDeleteTarget(null)}>
                  취소
                </button>
                <button
                  type="button"
                  className="barn-confirm-danger"
                  onClick={() => {
                    removeBarnRef.current?.(deleteTarget.id);
                    setDeleteTarget(null);
                  }}
                >
                  삭제
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )}

    {/* 근거 자료 및 출처 상세 안내 모달 (barn-module DOM 복제 영향 받지 않도록 외부에 렌더링) */}
    {selectedInfoKey && SIMULATION_EVIDENCES[selectedInfoKey] && (
      <div
        className="evidence-modal-overlay"
        onClick={() => setSelectedInfoKey(null)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-modal-title"
      >
        <div
          className="evidence-modal-content"
          onClick={e => e.stopPropagation()}
        >
          <div className="evidence-modal-header">
            <div className="evidence-modal-title-wrap">
              <span className="evidence-badge">
                {SIMULATION_EVIDENCES[selectedInfoKey].badge}
              </span>
              <h4 id="evidence-modal-title" className="evidence-modal-title">
                {SIMULATION_EVIDENCES[selectedInfoKey].title}
              </h4>
            </div>
            <button
              type="button"
              className="evidence-close-btn"
              onClick={() => setSelectedInfoKey(null)}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>

          <div className="evidence-modal-body">
            <div className="evidence-section">
              <div className="evidence-section-label">
                <span className="evidence-icon">🏛</span> 출처 및 참고 연구
              </div>
              <div className="evidence-source-box">
                {SIMULATION_EVIDENCES[selectedInfoKey].source}
              </div>
            </div>

            <div className="evidence-section">
              <div className="evidence-section-label">
                <span className="evidence-icon">💡</span> 산출 원리 및 개요
              </div>
              <p className="evidence-summary-text">
                {SIMULATION_EVIDENCES[selectedInfoKey].summary}
              </p>
            </div>

            <div className="evidence-section">
              <div className="evidence-section-label">
                <span className="evidence-icon">📋</span> 과학적 근거 및 신빙성 요소
              </div>
              <ul className="evidence-detail-list">
                {SIMULATION_EVIDENCES[selectedInfoKey].details.map((detail, idx) => (
                  <li key={idx} className="evidence-detail-item">
                    <span className="evidence-bullet">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="evidence-modal-footer">
            <button
              type="button"
              className="evidence-confirm-btn"
              onClick={() => setSelectedInfoKey(null)}
            >
              확인
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
};
