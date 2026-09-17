import React, { useState } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { CompostProvider, useCompost } from './contexts/CompostContext';
import { AccessProvider, useAccess } from './contexts/AccessContext';
import { AccessGate } from './components/app/AccessGate';
import { ToastProvider } from './contexts/ToastContext';
import { Toast } from './components/common/Toast';
import { GoogleSyncModal } from './components/common/GoogleSyncModal';
import { HelpModal } from './components/common/HelpModal';
import { AboutModal } from './components/common/AboutModal';
import { AppShell } from './components/app/AppShell';
import { TodayView } from './components/dashboard/TodayView';
import { InspectionView } from './components/monitoring/InspectionView';
import { MonitoringView } from './components/monitoring/MonitoringView';
import { LocationStatusView } from './components/history/LocationStatusView';
import { SimulationView } from './components/simulation/SimulationView';
import { AIAssistantView } from './components/assistant/AIAssistantView';
import { CollectionImpactDashboard } from './components/impact/CollectionImpactDashboard';
import { SettingsView } from './components/settings/SettingsView';

/** 내용이 짧으면 헤더와 하단 탭 사이 가운데에 두는 현장 화면들 (길면 위에서부터 스크롤) */
const CENTERED_TABS = new Set(['today', 'inspection', 'monitoring', 'history']);

/** 목장 매니저가 열 수 있는 화면 — 현장점검(자기 목장)·설정(화면·접속) */
const MANAGER_TABS = new Set(['today', 'inspection', 'settings']);

const TabContent: React.FC = () => {
  const { activeTab, setActiveTab } = useCompost();
  const { isManager } = useAccess();
  const blocked = isManager && !MANAGER_TABS.has(activeTab);

  // 매니저가 막힌 화면으로 들어오면 현장점검으로 돌린다
  React.useEffect(() => {
    if (blocked) setActiveTab('today');
  }, [blocked, setActiveTab]);

  // ?workspace= 파라미터가 있는 경우 해당 분석 탭으로 자동 연결
  React.useEffect(() => {
    if (isManager) return;
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const ws = url.searchParams.get('workspace');
      if (ws === 'impact') {
        if (activeTab !== 'impact') setActiveTab('impact');
      } else if (ws === 'assistant') {
        if (activeTab !== 'assistant') setActiveTab('assistant');
      } else if (ws === 'simulator') {
        if (activeTab !== 'simulation') setActiveTab('simulation');
      }
    }
  }, [activeTab, setActiveTab, isManager]);

  if (blocked) return null;

  return (
    <div key={activeTab} className={`view-enter w-full ${CENTERED_TABS.has(activeTab) ? 'my-auto' : ''}`}>
      {activeTab === 'today' && <TodayView />}
      {activeTab === 'inspection' && <InspectionView />}
      {activeTab === 'monitoring' && <MonitoringView />}
      {activeTab === 'history' && <LocationStatusView />}
      {activeTab === 'simulation' && <SimulationView />}
      {activeTab === 'assistant' && <AIAssistantView />}
      {activeTab === 'impact' && <CollectionImpactDashboard />}
      {(activeTab === 'settings' || activeTab === 'data_management') && <SettingsView />}
    </div>
  );
};

export const App: React.FC = () => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  return (
    <ThemeProvider>
      <ToastProvider>
        {/* 접속 코드를 확인한 뒤에만 기록을 불러온다 */}
        <AccessProvider>
          <AccessGate>
            <CompostProvider>
              <AppShell onOpenHelp={() => setIsHelpOpen(true)} onOpenAbout={() => setIsAboutOpen(true)}>
                <TabContent />
              </AppShell>
              <GoogleSyncModal />
              <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
              <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
            </CompostProvider>
          </AccessGate>
        </AccessProvider>
        <Toast />
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
