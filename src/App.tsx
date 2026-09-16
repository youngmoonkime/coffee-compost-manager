import React, { useState } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { CompostProvider, useCompost } from './contexts/CompostContext';
import { ToastProvider } from './contexts/ToastContext';
import { Toast } from './components/common/Toast';
import { GoogleSyncModal } from './components/common/GoogleSyncModal';
import { HelpModal } from './components/common/HelpModal';
import { AboutModal } from './components/common/AboutModal';
import { AppShell } from './components/app/AppShell';
import { TodayView } from './components/dashboard/TodayView';
import { MonitoringView } from './components/monitoring/MonitoringView';
import { LocationStatusView } from './components/history/LocationStatusView';
import { SimulationView } from './components/simulation/SimulationView';
import { SettingsView } from './components/settings/SettingsView';

const TabContent: React.FC = () => {
  const { activeTab } = useCompost();

  return (
    <div key={activeTab} className="view-enter w-full">
      {activeTab === 'today' && <TodayView />}
      {activeTab === 'monitoring' && <MonitoringView />}
      {activeTab === 'history' && <LocationStatusView />}
      {activeTab === 'simulation' && <SimulationView />}
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
        <CompostProvider>
          <AppShell
            onOpenHelp={() => setIsHelpOpen(true)}
            onOpenAbout={() => setIsAboutOpen(true)}
          >
            <TabContent />
          </AppShell>
          <Toast />
          <GoogleSyncModal />
          <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
          <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
        </CompostProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
