import React, { useEffect, useRef } from 'react';
import { CompostProvider, useCompost } from './contexts/CompostContext';
import { ToastProvider } from './contexts/ToastContext';
import { Header } from './components/common/Header';
import { Navigation } from './components/common/Navigation';
import { Toast } from './components/common/Toast';
import { GoogleSyncModal } from './components/common/GoogleSyncModal';
import { MonitoringView } from './components/monitoring/MonitoringView';
import { LocationStatusView } from './components/history/LocationStatusView';
import { SettingsView } from './components/settings/SettingsView';

const MainContent: React.FC = () => {
  const { activeTab } = useCompost();
  const scrollRef = useRef<HTMLElement>(null);

  // 탭 전환 시 이전 탭의 스크롤 위치가 남지 않도록 상단으로 복귀
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);

  return (
    <main
      ref={scrollRef}
      className="flex flex-col flex-1 min-h-0 relative w-full max-w-xl mx-auto pt-20 overflow-y-auto overflow-x-hidden px-4 sm:px-5 smooth-scroll scroll-area"
    >
      {activeTab === 'monitoring' && <MonitoringView />}
      {activeTab === 'history' && <LocationStatusView />}
      {activeTab === 'settings' && <SettingsView />}
    </main>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <CompostProvider>
        <div className="bg-surface text-on-surface flex flex-col antialiased selection:bg-primary selection:text-on-primary h-full min-h-0 w-full overflow-hidden">
          <Header />
          <Toast />
          <GoogleSyncModal />
          <MainContent />
          <Navigation />
        </div>
      </CompostProvider>
    </ToastProvider>
  );
};

export default App;
