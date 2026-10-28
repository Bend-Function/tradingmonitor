import { INSTRUMENTS, INTERVALS } from './market';
import type { Interval, Market } from './market';
import { LAYOUTS } from './types';
import type { DashboardSettings, IndicatorVisibility, Layout, PanelConfig, Theme } from './types';

const STORAGE_KEY = 'yixian.demo.workspace.v1';
const DEFAULT_INDICATORS: IndicatorVisibility = {
  sma: true,
  ema: false,
  rsi: false,
  volume: true,
};

const DEFAULT_PANEL: PanelConfig = {
  id: 'panel-btc',
  symbol: 'BTCUSDT',
  interval: '15m',
  indicators: DEFAULT_INDICATORS,
};

export const FALLBACK_PANEL = DEFAULT_PANEL;

export function createDefaultSettings(): DashboardSettings {
  const panels: PanelConfig[] = [
    DEFAULT_PANEL,
    { id: 'panel-eth', symbol: 'ETHUSDT', interval: '15m', indicators: DEFAULT_INDICATORS },
    { id: 'panel-sol', symbol: 'SOLUSDT', interval: '1h', indicators: DEFAULT_INDICATORS },
    { id: 'panel-bnb', symbol: 'BNBUSDT', interval: '5m', indicators: DEFAULT_INDICATORS },
  ];
  return {
    market: 'spot',
    layout: 4,
    panels,
    selectedId: DEFAULT_PANEL.id,
    theme: 'dark',
  };
}

export function createPanel(symbol: string, interval: Interval = '15m'): PanelConfig {
  return {
    id: `panel-${Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) => value.toString(16).padStart(8, '0')).join('')}`,
    symbol,
    interval,
    indicators: DEFAULT_INDICATORS,
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
  ) return null;
  return { sma: value.sma, ema: value.ema, rsi: value.rsi, volume: value.volume };
}

function parseSettings(value: unknown): DashboardSettings | null {
  if (!isRecord(value) || !isMarket(value.market) || !isTheme(value.theme) || !isLayout(value.layout)) {
    return null;
  }
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
  return {
    market: value.market,
    layout: value.layout,
    panels,
    selectedId: value.selectedId,
    theme: value.theme,
  };
}

export function readSettings(): DashboardSettings | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return null;
    return parseSettings(JSON.parse(stored) as unknown);
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
