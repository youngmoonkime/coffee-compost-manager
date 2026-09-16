import React, { useEffect, useRef } from 'react';
import { useCompost } from '../../contexts/CompostContext';
import { useTheme } from '../../contexts/ThemeContext';
import './barnSimulation.css';

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
  density: number;
  price: number;
  sensors?: BarnSensor[];
}

export const SimulationView: React.FC = () => {
  const { setActiveTab } = useCompost();
  const { theme, toggleTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  /** 처음 그려진 마크업. 아래 효과가 다시 돌 때 항상 이 상태에서 시작한다 */
  const pristineRef = useRef<DocumentFragment | null>(null);
  /** 테마가 바뀌었을 때 3D 장면만 다시 그리게 하는 연결 고리 */
  const redrawRef = useRef<(() => void) | null>(null);
  /** 효과를 다시 만들지 않고도 최신 콜백을 쓰기 위한 보관함 */
  const handlersRef = useRef({ setActiveTab, toggleTheme });

  useEffect(() => {
    handlersRef.current = { setActiveTab, toggleTheme };
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
      name: '다원목장 · 측정동',
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
      density: 500,
      price: 120000,
    };

    let barns: BarnData[] = [{ ...defaults, id: 1 }];
    let selected = 1;
    let nextId = 2;
    let yaw = 35;
    let pointer: number | null = null;
    let px = 0;
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
      bedding: ['mix', 'day', 'mass', 'density', 'price'],
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
      if (rem) rem.disabled = barns.length === 1;
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
      'density',
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
      const scale = Math.min((W - 64) / (xmax - xmin || 1), (H - 72) / (ymax - ymin || 1));

      const P = (t: BarnData, x: number, y: number, z = 0): [number, number] => {
        const a = raw(world(t, x, y, z));
        return [
          W / 2 + (a[0] - (xmin + xmax) / 2) * scale,
          H / 2 + (a[1] - (ymin + ymax) / 2) * scale,
        ];
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

        hotspot('sensor-' + i, sen.name + ' 편집', p[0], p[1] + 20, 'a', b.id);
        const btn = hotButtons.get('sensor-' + i);
        if (btn) {
          btn.onclick = () => {
            sensorIndex = i;
            selectPart('a');
          };
        }
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
        savingEl.textContent = '예상 톱밥 구매 절감 ' + Math.round((b.mass / b.density) * b.price).toLocaleString('ko-KR') + '원 · 선택 동 ' + b.mass.toLocaleString() + 'kg 사용 가정';
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
              scenario: { day: t.day, mix: t.mix, mass: t.mass, density: t.density, price: t.price },
            })),
          },
          null,
          2
        );
      }

      for (const [key, label, x, y, z] of [
        ['bedding', '도포 설정', b.length * 0.5, b.width * 0.85, 0.1],
        ['passage', '통로 설정', b.length * 0.5, b.width * 0.15, 0.1],
      ] as const) {
        const p = P(b, x, y, z);
        hotspot(key, label, p[0], p[1] + 22, key, b.id);
      }

      if (activePart === 'barn') {
        stroke(b, [[0, 0], [b.length, 0], [b.length, b.width], [0, b.width], [0, 0]], ink, [], 2.5);
      }

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
      const density = Math.max(1, Number(q<HTMLInputElement>('density')?.value || 1));
      const price = Number(q<HTMLInputElement>('price')?.value || 0);
      const saving = Math.round((mass / density) * price);
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
      if (savingValEl) savingValEl.textContent = saving.toLocaleString('ko-KR') + '원';
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

    q('remove')?.addEventListener('click', () => {
      if (barns.length === 1) return;
      barns = barns.filter(t => t.id !== selected);
      selected = barns[0].id;
      load();
    });

    q('left')?.addEventListener('click', () => {
      yaw -= 10;
      requestDraw();
    });

    q('right')?.addEventListener('click', () => {
      yaw += 10;
      requestDraw();
    });

    // 3D 드래그 회전 이벤트
    const handlePointerDown = (e: PointerEvent) => {
      if (pointer !== null || e.button !== 0) return;
      pointer = e.pointerId;
      px = e.clientX;
      canvas.setPointerCapture(pointer);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      yaw += (e.clientX - px) * 0.35;
      px = e.clientX;
      requestDraw();
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerId === pointer) pointer = null;
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

    const setSheet = (open: boolean) => {
      inspector.classList.toggle('sheet-open', open);
      overlaySheet.classList.toggle('show', open);
      // 팝업이 떠 있는 동안 뒤 화면이 같이 밀리지 않게 한다
      document.body.classList.toggle('barn-sheet-open', open);
      if (open) {
        inspector.scrollTop = 0;
        // 값을 고치는 동안 3D 화면이 팝업 위쪽에 보이도록 맞춘다
        if (isMobile()) scene?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    };

    inspector.querySelector('h3')?.addEventListener('click', () => {
      if (isMobile()) setSheet(!inspector.classList.contains('sheet-open'));
    });

    inspector.querySelector('.mobile-sheet-handle')?.addEventListener('click', () => setSheet(false));
    inspector.querySelector('#bm-sheet-close')?.addEventListener('click', () => setSheet(false));
    overlaySheet.addEventListener('click', () => setSheet(false));

    // 가로로 돌리거나 큰 화면이 되면 팝업 상태를 풀어 준다 (옆 패널로 돌아간다)
    const wide = window.matchMedia('(min-width:901px)');
    const handleWide = () => {
      if (wide.matches) setSheet(false);
    };
    wide.addEventListener('change', handleWide);

    // 더보기 메뉴 및 상단 액션
    const menuEl = root.querySelector<HTMLDivElement>('#apple-menu');
    const moreBtn = root.querySelector<HTMLButtonElement>('#apple-more');
    const closeMenu = () => menuEl?.classList.remove('open');

    moreBtn?.addEventListener('click', e => {
      e.stopPropagation();
      menuEl?.classList.toggle('open');
    });

    const handleDocClick = (e: MouseEvent) => {
      if (menuEl && !menuEl.contains(e.target as Node) && e.target !== moreBtn) {
        closeMenu();
      }
    };
    document.addEventListener('click', handleDocClick);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
        setSheet(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    root.querySelector('#apple-open-inspector')?.addEventListener('click', () => {
      closeMenu();
      if (isMobile()) {
        setSheet(true);
      } else {
        inspector.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    root.querySelector('#apple-show-code')?.addEventListener('click', () => {
      closeMenu();
      const details = root.querySelector<HTMLDetailsElement>('details.panel');
      if (details) {
        details.open = true;
        details.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    root.querySelector('#apple-help')?.addEventListener('click', () => {
      closeMenu();
      alert(
        '3D 화면을 드래그해 회전하고, 축사·센서·통로·도포 지점을 선택해 값을 조정하세요. 결과는 연구 상대 변화율을 적용한 참고 시뮬레이션이며 실측 예측값이 아닙니다.'
      );
    });

    // 뒤로가기 버튼: 오늘 탭으로 이동
    root.querySelector('.apple-back')?.addEventListener('click', () => {
      handlersRef.current.setActiveTab('today');
    });

    // 테마 토글 버튼
    const themeBtn = root.querySelector<HTMLButtonElement>('#apple-theme');
    const updateThemeIcon = () => {
      if (themeBtn) {
        themeBtn.textContent = document.documentElement.classList.contains('dark') ? '☾' : '☀';
      }
    };
    // 테마가 바뀌면 색만 다시 읽어 그린다 — 시뮬레이션 상태는 그대로 둔다
    const refreshTheme = () => {
      updateThemeIcon();
      colorCache.clear();
      requestDraw();
    };
    themeBtn?.addEventListener('click', () => {
      handlersRef.current.toggleTheme();
      setTimeout(refreshTheme, 50);
    });
    updateThemeIcon();
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
      document.removeEventListener('click', handleDocClick);
      document.removeEventListener('keydown', handleKeyDown);
      wide.removeEventListener('change', handleWide);
      viewHost?.classList.remove('barn-view-host');
      document.body.classList.remove('barn-sheet-open');
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
    <div id="barn-module" ref={containerRef}>
      {/* 상단 네비게이션 헤더 */}
      <header className="apple-header">
        <div className="apple-header-left">
          <button type="button" className="apple-back" aria-label="이전 화면">
            <span aria-hidden="true">‹</span>
          </button>
          <div className="apple-title-wrap">
            <div className="apple-title">축사 시뮬레이션</div>
            <div className="apple-subtitle" id="apple-barn-subtitle">
              현재 축사
            </div>
          </div>
        </div>
        <div className="apple-actions">
          <button type="button" className="apple-icon-btn" id="apple-theme" aria-label="라이트/다크 모드 전환">
            ☀
          </button>
          <div className="apple-more-wrap">
            <button type="button" className="apple-icon-btn" id="apple-more" aria-label="더보기 메뉴 열기">
              •••
            </button>
            <div className="apple-menu" id="apple-menu" role="menu">
              <button type="button" id="apple-open-inspector" role="menuitem">
                선택 항목 설정
              </button>
              <button type="button" id="apple-show-code" role="menuitem">
                현재 설정 코드 보기
              </button>
              <hr />
              <button type="button" id="apple-help" role="menuitem">
                사용 안내
              </button>
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
          <button id="bm-remove" className="cursor-interaction" type="button">
            선택 축사 삭제
          </button>
        </div>
        <p className="muted">
          다원목장 방식의 예시 배치입니다. 초기 30 × 22m는 기존 그림의 부분 구역을 참고한 임시값이며, 현장 실측 규격이 아닙니다.
        </p>
        <div className="fields">
          <label>
            축사 이름
            <input id="bm-name" defaultValue="다원목장 · 측정동" />
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
              <input id="bm-x" type="number" min="-200" max="200" defaultValue="0" />
            </label>
            <label>
              배치 Y (m)
              <input id="bm-y" type="number" min="-200" max="200" defaultValue="0" />
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
          <span className="muted">↔ 화면을 좌우로 드래그해 회전</span>
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
        <span className="muted">
          색상은 예시값 2점을 연결한 공간 보간입니다. 실측 분포나 기류 해석이 아니며, 암모니아 센서 ppm과 다른 지표입니다.
        </span>
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
          시간 변화는 이전 한우 연구의 상대 변화율을 적용한 가정입니다. 도포량·축사 크기로 효과를 보정하지 않으며, 다원목장 예측값이 아닙니다.
        </p>
        <div id="bm-saving" className="status" aria-live="polite"></div>
        <details>
          <summary className="cursor-interaction">톱밥 비용 가정</summary>
          <div className="fields">
            <label>
              커피박 밀도 (kg/m³)
              <input id="bm-density" type="number" min="1" max="1500" defaultValue="500" />
            </label>
            <label>
              톱밥 단가 (원/m³)
              <input id="bm-price" type="number" min="0" max="1000000" defaultValue="120000" />
            </label>
          </div>
          <p className="muted">동일 부피의 톱밥 대체 가정 · 운송·처리비 차감 전 · 실제 구매 절감 보장 아님</p>
        </details>
      </div>

      {/* 결과 요약 카드 (Apple 스타일) */}
      <section className="apple-results">
        <div className="apple-section-title">
          <h3>시뮬레이션 결과</h3>
          <span>연구 상대 변화율 기반 참고값</span>
        </div>
        <div className="result-grid">
          <article className="result-card primary">
            <div className="result-label">예상 악취 변화</div>
            <div className="result-value" id="apple-odor">
              —
            </div>
            <div className="result-note" id="apple-odor-note">
              초기값 대비 상대 변화
            </div>
          </article>
          <article className="result-card">
            <div className="result-label">예상 톱밥 구매 절감</div>
            <div className="result-value" id="apple-saving">
              —
            </div>
            <div className="result-note">동일 부피 대체 가정</div>
          </article>
          <article className="result-card">
            <div className="result-label">경과</div>
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
              <div className="condition-label">커피박 사용량</div>
              <div className="condition-value" id="apple-mass">
                500 kg
              </div>
            </div>
            <div className="condition-item">
              <div className="condition-label">축사 크기</div>
              <div className="condition-value" id="apple-size">
                30 × 22m
              </div>
            </div>
            <div className="condition-item">
              <div className="condition-label">센서</div>
              <div className="condition-value" id="apple-sensors">
                2개
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 축사 설정 JSON 코드 */}
      <details className="panel">
        <summary className="cursor-interaction">현재 축사 설정 코드 보기</summary>
        <pre id="bm-code"></pre>
      </details>
    </div>
  );
};
