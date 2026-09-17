import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  WORKSPACE_TABS,
  WorkspaceTabs,
  type WorkspaceTabId,
} from './WorkspaceTabs';
import {
  SIMULATOR_BRIDGE_SOURCE,
  SIMULATOR_BRIDGE_VERSION,
  WORKSPACE_BRIDGE_SOURCE,
  isSimulatorSnapshot,
  readStoredSimulatorState,
  storeSimulatorState,
  type SimulatorSnapshot,
  type SimulatorToWorkspaceMessage,
  type WorkspaceToSimulatorMessage,
} from './simulatorBridge';
import { CollectionImpactDashboard } from '../impact/CollectionImpactDashboard';
import '../../styles/workspace-tabs.css';

const TAB_PARAM = 'workspace';

function readInitialTab(): WorkspaceTabId {
  if (typeof window === 'undefined') return 'simulator';
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get(TAB_PARAM);
  if (fromUrl === 'simulator' || fromUrl === 'impact' || fromUrl === 'assistant') {
    return fromUrl;
  }
  const saved = window.sessionStorage.getItem('coffee-workspace-tab');
  if (saved === 'simulator' || saved === 'impact' || saved === 'assistant') {
    return saved;
  }
  return 'simulator';
}

function readHostTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  const root = document.documentElement;
  if (root.classList.contains('dark') || root.dataset.theme === 'dark') return 'dark';
  if (root.dataset.theme === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function WorkspaceShell() {
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>(readInitialTab);
  const [simulatorState, setSimulatorState] = useState<SimulatorSnapshot | null>(() =>
    typeof window === 'undefined' ? null : readStoredSimulatorState(),
  );
  const simulatorFrameRef = useRef<HTMLIFrameElement>(null);
  const simulatorReadyRef = useRef(false);

  const activeMeta = useMemo(
    () => WORKSPACE_TABS.find((tab) => tab.id === activeTab) ?? WORKSPACE_TABS[0],
    [activeTab],
  );

  const postToSimulator = useCallback((message: WorkspaceToSimulatorMessage) => {
    simulatorFrameRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);

  const syncThemeToSimulator = useCallback(() => {
    postToSimulator({
      source: WORKSPACE_BRIDGE_SOURCE,
      version: SIMULATOR_BRIDGE_VERSION,
      type: 'SET_THEME',
      payload: { theme: readHostTheme() },
    });
  }, [postToSimulator]);

  const changeTab = (next: WorkspaceTabId) => {
    setActiveTab(next);
    window.sessionStorage.setItem('coffee-workspace-tab', next);

    const url = new URL(window.location.href);
    url.searchParams.set(TAB_PARAM, next);
    window.history.replaceState({}, '', url);

    if (next === 'simulator') {
      requestAnimationFrame(() => {
        postToSimulator({
          source: WORKSPACE_BRIDGE_SOURCE,
          version: SIMULATOR_BRIDGE_VERSION,
          type: 'SIMULATOR_VIEW_VISIBLE',
        });
      });
    }
  };

  useEffect(() => {
    const onPopState = () => setActiveTab(readInitialTab());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent<SimulatorToWorkspaceMessage>) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== simulatorFrameRef.current?.contentWindow) return;

      const message = event.data;
      if (
        !message ||
        message.source !== SIMULATOR_BRIDGE_SOURCE ||
        message.version !== SIMULATOR_BRIDGE_VERSION
      ) {
        return;
      }

      if (message.type === 'SIMULATOR_READY') {
        simulatorReadyRef.current = true;
        const stored = readStoredSimulatorState();
        if (stored) {
          postToSimulator({
            source: WORKSPACE_BRIDGE_SOURCE,
            version: SIMULATOR_BRIDGE_VERSION,
            type: 'RESTORE_SIMULATOR_STATE',
            payload: stored,
          });
        } else {
          postToSimulator({
            source: WORKSPACE_BRIDGE_SOURCE,
            version: SIMULATOR_BRIDGE_VERSION,
            type: 'REQUEST_SIMULATOR_STATE',
          });
        }
        syncThemeToSimulator();
        return;
      }

      if (message.type === 'SIMULATOR_STATE' && isSimulatorSnapshot(message.payload)) {
        setSimulatorState(message.payload);
        storeSimulatorState(message.payload);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [postToSimulator, syncThemeToSimulator]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const observer = new MutationObserver(syncThemeToSimulator);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    media.addEventListener('change', syncThemeToSimulator);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', syncThemeToSimulator);
    };
  }, [syncThemeToSimulator]);

  return (
    <div className="workspace-shell">
      <header className="workspace-global-nav">
        <div className="workspace-global-nav__inner">
          <div className="workspace-brand">
            <span className="workspace-brand__eyebrow">커피박 자원순환</span>
            <strong className="workspace-brand__title">현장 관리 도구</strong>
          </div>
          <WorkspaceTabs value={activeTab} onChange={changeTab} />
        </div>
      </header>

      <main className="workspace-main">
        <section className="workspace-context" aria-live="polite">
          <div>
            <p className="workspace-context__label">현재 도구</p>
            <h1>{activeMeta.label}</h1>
            <p>{activeMeta.description}</p>
          </div>
        </section>

        {/*
          SimulatorPanel은 iframe 캔버스 상태 보존을 위해 unmount하지 않고 hidden 처리합니다.
        */}
        <section
          id="workspace-panel-simulator"
          className="workspace-panel"
          role="tabpanel"
          aria-labelledby="workspace-tab-simulator"
          hidden={activeTab !== 'simulator'}
        >
          <SimulatorPanel frameRef={simulatorFrameRef} />
        </section>

        <section
          id="workspace-panel-impact"
          className="workspace-panel"
          role="tabpanel"
          aria-labelledby="workspace-tab-impact"
          hidden={activeTab !== 'impact'}
        >
          {activeTab === 'impact' && <CollectionImpactDashboard />}
        </section>

        <section
          id="workspace-panel-assistant"
          className="workspace-panel"
          role="tabpanel"
          aria-labelledby="workspace-tab-assistant"
          hidden={activeTab !== 'assistant'}
        >
          <AIAssistantPlaceholder simulatorState={simulatorState} />
        </section>
      </main>
    </div>
  );
}

function SimulatorPanel({ frameRef }: { frameRef: RefObject<HTMLIFrameElement | null> }) {
  return (
    <div className="workspace-embed-card">
      <iframe
        ref={frameRef}
        className="workspace-simulator-frame"
        src={`${import.meta.env.BASE_URL}barn_module_apple_redesign_fixed.html?embedded=1`}
        title="축사 시뮬레이터"
        loading="eager"
      />
    </div>
  );
}

function AIAssistantPlaceholder({ simulatorState }: { simulatorState: SimulatorSnapshot | null }) {
  return (
    <div className="workspace-placeholder-card">
      <div className="workspace-placeholder-card__icon" aria-hidden="true">✦</div>
      <div>
        <span className="workspace-placeholder-card__badge">3단계 예정</span>
        <h2>지소행 AI 현장 어시스턴트</h2>
        <p>
          Gemini API는 서버 엔드포인트를 통해 연결하고, 시뮬레이터의 현재 조건을
          AI 입력 컨텍스트로 전달합니다.
        </p>
        <p className="workspace-bridge-status" role="status">
          {simulatorState
            ? `AI 컨텍스트 준비됨 · ${simulatorState.summary.barnName} · ${simulatorState.summary.coffeeGroundsKg.toLocaleString('ko-KR')}kg`
            : 'AI 컨텍스트 연결 대기 중'}
        </p>
      </div>
    </div>
  );
}
