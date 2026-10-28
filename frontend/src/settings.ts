import { INSTRUMENTS, INTERVALS } from './market';
import type { Interval, Market } from './market';
import { LAYOUTS } from './types';
import type {
  DashboardSettings,
  IndicatorVisibility,
  Layout,
  PanelConfig,
  Theme,
  UtilityWidgetKind,
  WorkspaceBlueprint,
  WorkspaceWidget,
  WidgetPosition,
} from './types';
import {
  createWorkspaceWidgets,
  nextWidgetPosition,
  normalizePosition,
  resolveWidgetOverlaps,
} from './workspace';

const STORAGE_KEY = 'yixian.demo.workspace.v1';
const BLUEPRINT_STORAGE_KEY = 'yixian.demo.blueprints.v2';
const DEFAULT_INDICATORS: IndicatorVisibility = {
  sma: true,
  ema: false,
  rsi: false,
  cci: false,
  volume: true,
};

const DEFAULT_PANEL: PanelConfig = {
  id: 'panel-btc',
  symbol: 'BTCUSDT',
  interval: '15m',
  indicators: { ...DEFAULT_INDICATORS, rsi: true },
};

export const FALLBACK_PANEL = DEFAULT_PANEL;

function createId(prefix: string): string {
  return `${prefix}-${Array.from(
    crypto.getRandomValues(new Uint32Array(4)),
    (value) => value.toString(16).padStart(8, '0'),
  ).join('')}`;
}

export function createDefaultSettings(): DashboardSettings {
  const panels: PanelConfig[] = [
    DEFAULT_PANEL,
    { id: 'panel-eth', symbol: 'ETHUSDT', interval: '15m', indicators: DEFAULT_INDICATORS },
    { id: 'panel-sol', symbol: 'SOLUSDT', interval: '1h', indicators: DEFAULT_INDICATORS },
  ];
  return {
    version: 2,
    market: 'spot',
    layout: 4,
    panels,
    selectedId: DEFAULT_PANEL.id,
    theme: 'dark',
    widgets: createWorkspaceWidgets(panels, 'spot'),
    layoutLocked: true,
  };
}

export function createPanel(symbol: string, interval: Interval = '15m'): PanelConfig {
  return {
    id: createId('panel'),
    symbol,
    interval,
    indicators: DEFAULT_INDICATORS,
  };
}

export function createUtilityWidget(
  kind: UtilityWidgetKind,
  symbol: string,
  market: Market,
  widgets: readonly WorkspaceWidget[],
): WorkspaceWidget {
  const id = createId(kind);
  return {
    id,
    kind,
    symbol,
    market,
    visible: true,
    position: nextWidgetPosition(widgets, id),
  };
}

export function layoutForCount(count: number): Layout {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 4;
  return 6;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMarket(value: unknown): value is Market {
  return value === 'spot' || value === 'usdm';
}

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}

function isLayout(value: unknown): value is Layout {
  return typeof value === 'number' && (LAYOUTS as readonly number[]).includes(value);
}

function isInterval(value: unknown): value is Interval {
  return typeof value === 'string' && (INTERVALS as readonly string[]).includes(value);
}

function isInstrument(value: unknown): value is string {
  return typeof value === 'string' && INSTRUMENTS.some((instrument) => instrument.symbol === value);
}

function parseIndicators(value: unknown): IndicatorVisibility | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.sma !== 'boolean'
    || typeof value.ema !== 'boolean'
    || typeof value.rsi !== 'boolean'
    || typeof value.volume !== 'boolean'
    || (value.cci !== undefined && typeof value.cci !== 'boolean')
  ) return null;
  return {
    sma: value.sma,
    ema: value.ema,
    rsi: value.rsi,
    cci: value.cci ?? false,
    volume: value.volume,
  };
}

function parsePosition(value: unknown, id: string): WidgetPosition | null {
  if (!isRecord(value) || value.i !== id) return null;
  if (
    typeof value.x !== 'number' || !Number.isFinite(value.x)
    || typeof value.y !== 'number' || !Number.isFinite(value.y)
    || typeof value.w !== 'number' || !Number.isFinite(value.w)
    || typeof value.h !== 'number' || !Number.isFinite(value.h)
  ) return null;
  return normalizePosition({ i: id, x: value.x, y: value.y, w: value.w, h: value.h });
}

function parseWidgets(
  value: unknown,
  panels: readonly PanelConfig[],
  market: Market,
): readonly WorkspaceWidget[] | null {
  // v1 workspaces have no widget collection; create a mixed preset around their panels.
  if (value === undefined) return createWorkspaceWidgets(panels, market);
  if (!Array.isArray(value)) return null;
  const widgets: WorkspaceWidget[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || candidate.id.length === 0) return null;
    if (typeof candidate.visible !== 'boolean') return null;
    const position = parsePosition(candidate.position, candidate.id);
    if (position === null) return null;
    if (candidate.kind === 'chart') {
      widgets.push({ id: candidate.id, kind: 'chart', visible: candidate.visible, position });
      continue;
    }
    if (candidate.kind !== 'watchlist' && candidate.kind !== 'orderbook' && candidate.kind !== 'depth') {
      return null;
    }
    if (!isInstrument(candidate.symbol) || !isMarket(candidate.market)) return null;
    widgets.push({
      id: candidate.id,
      kind: candidate.kind,
      symbol: candidate.symbol,
      market: candidate.market,
      visible: candidate.visible,
      position,
    });
  }
  if (new Set(widgets.map((widget) => widget.id)).size !== widgets.length) return null;
  const chartIds = widgets.filter((widget) => widget.kind === 'chart').map((widget) => widget.id);
  if (chartIds.length !== panels.length || panels.some((panel) => !chartIds.includes(panel.id))) return null;
  return resolveWidgetOverlaps(widgets);
}

function parseSettings(value: unknown): DashboardSettings | null {
  if (!isRecord(value) || !isMarket(value.market) || !isTheme(value.theme) || !isLayout(value.layout)) {
    return null;
  }
  if (value.version !== undefined && value.version !== 1 && value.version !== 2) return null;
  if (!Array.isArray(value.panels) || value.panels.length < 1 || value.panels.length > 6) return null;
  const panels: PanelConfig[] = [];
  for (const candidate of value.panels) {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || candidate.id.length === 0) return null;
    if (!isInstrument(candidate.symbol) || !isInterval(candidate.interval)) return null;
    const indicators = parseIndicators(candidate.indicators);
    if (indicators === null) return null;
    panels.push({
      id: candidate.id,
      symbol: candidate.symbol,
      interval: candidate.interval,
      indicators,
    });
  }
  if (new Set(panels.map((panel) => panel.id)).size !== panels.length) return null;
  if (typeof value.selectedId !== 'string' || !panels.some((panel) => panel.id === value.selectedId)) {
    return null;
  }
  const widgets = parseWidgets(value.widgets, panels, value.market);
  if (widgets === null) return null;
  if (value.layoutLocked !== undefined && typeof value.layoutLocked !== 'boolean') return null;
  return {
    version: 2,
    market: value.market,
    layout: value.layout,
    panels,
    selectedId: value.selectedId,
    theme: value.theme,
    widgets,
    layoutLocked: value.layoutLocked ?? true,
  };
}

export function readSettings(): DashboardSettings | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    return parseSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSettings(settings: DashboardSettings): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function clearSettings(): boolean {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function parseBlueprintStore(value: unknown): readonly WorkspaceBlueprint[] {
  if (!Array.isArray(value)) return [];
  const blueprints = new Map<string, WorkspaceBlueprint>();
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.name !== 'string') continue;
    const name = candidate.name.trim();
    if (name.length === 0 || name.length > 40) continue;
    const settings = parseSettings(candidate.settings);
    if (settings !== null) blueprints.set(name, { name, settings });
  }
  return [...blueprints.values()];
}

export function readBlueprints(): readonly WorkspaceBlueprint[] {
  try {
    const raw = window.localStorage.getItem(BLUEPRINT_STORAGE_KEY);
    return raw === null ? [] : parseBlueprintStore(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveBlueprint(name: string, settings: DashboardSettings): boolean {
  const normalizedName = name.trim();
  if (normalizedName.length === 0 || normalizedName.length > 40) return false;
  try {
    const blueprints = readBlueprints().filter((blueprint) => blueprint.name !== normalizedName);
    window.localStorage.setItem(BLUEPRINT_STORAGE_KEY, JSON.stringify([
      ...blueprints,
      { name: normalizedName, settings },
    ]));
    return true;
  } catch {
    return false;
  }
}
