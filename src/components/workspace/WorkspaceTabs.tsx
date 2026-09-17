import type { KeyboardEvent } from 'react';

export type WorkspaceTabId = 'simulator' | 'impact' | 'assistant';

export interface WorkspaceTab {
  id: WorkspaceTabId;
  label: string;
  shortLabel: string;
  description: string;
}

export const WORKSPACE_TABS: WorkspaceTab[] = [
  {
    id: 'simulator',
    label: '축사 시뮬레이터',
    shortLabel: '시뮬레이터',
    description: '축사 구조, 센서 배치, 도포 조건을 확인합니다.',
  },
  {
    id: 'impact',
    label: '자원순환 임팩트 리포터',
    shortLabel: '임팩트',
    description: '경제·환경 성과를 한눈에 정리합니다.',
  },
  {
    id: 'assistant',
    label: '지소행 AI 현장 어시스턴트',
    shortLabel: 'AI 어시스턴트',
    description: '현장 조건에 맞는 작업 가이드를 제공합니다.',
  },
];

interface WorkspaceTabsProps {
  value: WorkspaceTabId;
  onChange: (next: WorkspaceTabId) => void;
}

export function WorkspaceTabs({ value, onChange }: WorkspaceTabsProps) {
  const currentIndex = WORKSPACE_TABS.findIndex((tab) => tab.id === value);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    let nextIndex = currentIndex;

    if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + WORKSPACE_TABS.length) % WORKSPACE_TABS.length;
    } else if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % WORKSPACE_TABS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = WORKSPACE_TABS.length - 1;
    }

    const next = WORKSPACE_TABS[nextIndex];
    onChange(next.id);
    requestAnimationFrame(() => {
      document.getElementById(`workspace-tab-${next.id}`)?.focus();
    });
  };

  return (
    <div
      className="workspace-tabs"
      role="tablist"
      aria-label="커피박 자원순환 도구"
      onKeyDown={handleKeyDown}
    >
      {WORKSPACE_TABS.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            id={`workspace-tab-${tab.id}`}
            className="workspace-tab"
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`workspace-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            data-active={selected ? 'true' : 'false'}
            onClick={() => onChange(tab.id)}
          >
            <span className="workspace-tab__desktop-label">{tab.label}</span>
            <span className="workspace-tab__mobile-label">{tab.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
