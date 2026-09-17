export const SIMULATOR_BRIDGE_SOURCE = 'coffee-barn-simulator' as const;
export const WORKSPACE_BRIDGE_SOURCE = 'coffee-workspace' as const;
export const SIMULATOR_BRIDGE_VERSION = 1 as const;
export const SIMULATOR_STORAGE_KEY = 'coffee-simulator-state-v1';

export interface SimulatorSensorState {
  name: string;
  x: number;
  y: number;
  z: number;
  value: number;
}

export interface SimulatorBarnState {
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
  mix: number;
  day: number;
  mass: number;
  density: number;
  price: number;
  sensors: SimulatorSensorState[];
}

export interface SimulatorSummary {
  barnId: number;
  barnName: string;
  areaM2: number;
  coffeeGroundsKg: number;
  mixPercent: number;
  elapsedDays: number;
  sensorCount: number;
  densityKgM3: number;
  sawdustPricePerM3: number;
  estimatedSawdustSavingWon: number;
  relativeOdorChangePercent: number;
  basis: 'research-relative-simulation';
}

export interface SimulatorSnapshot {
  schema: 'coffee-barn-simulator-state';
  version: 1;
  updatedAt: string;
  selectedBarnId: number;
  activePart: 'barn' | 'a' | 'passage' | 'bedding';
  sensorIndex: number;
  barns: SimulatorBarnState[];
  summary: SimulatorSummary;
}

export type SimulatorToWorkspaceMessage =
  | {
      source: typeof SIMULATOR_BRIDGE_SOURCE;
      version: typeof SIMULATOR_BRIDGE_VERSION;
      type: 'SIMULATOR_READY';
    }
  | {
      source: typeof SIMULATOR_BRIDGE_SOURCE;
      version: typeof SIMULATOR_BRIDGE_VERSION;
      type: 'SIMULATOR_STATE';
      payload: SimulatorSnapshot;
    };

export type WorkspaceToSimulatorMessage =
  | {
      source: typeof WORKSPACE_BRIDGE_SOURCE;
      version: typeof SIMULATOR_BRIDGE_VERSION;
      type: 'REQUEST_SIMULATOR_STATE';
    }
  | {
      source: typeof WORKSPACE_BRIDGE_SOURCE;
      version: typeof SIMULATOR_BRIDGE_VERSION;
      type: 'RESTORE_SIMULATOR_STATE';
      payload: SimulatorSnapshot;
    }
  | {
      source: typeof WORKSPACE_BRIDGE_SOURCE;
      version: typeof SIMULATOR_BRIDGE_VERSION;
      type: 'SIMULATOR_VIEW_VISIBLE';
    }
  | {
      source: typeof WORKSPACE_BRIDGE_SOURCE;
      version: typeof SIMULATOR_BRIDGE_VERSION;
      type: 'SET_THEME';
      payload: { theme: 'light' | 'dark' };
    };

export function isSimulatorSnapshot(value: unknown): value is SimulatorSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SimulatorSnapshot>;
  return (
    candidate.schema === 'coffee-barn-simulator-state' &&
    candidate.version === 1 &&
    typeof candidate.selectedBarnId === 'number' &&
    Array.isArray(candidate.barns) &&
    candidate.barns.length > 0 &&
    !!candidate.summary &&
    typeof candidate.summary === 'object'
  );
}

export function readStoredSimulatorState(): SimulatorSnapshot | null {
  try {
    const raw = window.localStorage.getItem(SIMULATOR_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSimulatorSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function storeSimulatorState(snapshot: SimulatorSnapshot): void {
  try {
    window.localStorage.setItem(SIMULATOR_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Private mode / quota errors must not break the field workflow.
  }
}
