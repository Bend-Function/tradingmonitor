import type { Interval, Market } from './market';

export const LAYOUTS = [1, 2, 4, 6] as const;
export type Layout = (typeof LAYOUTS)[number];
export type Theme = 'dark' | 'light';
export type IndicatorKey = 'sma' | 'ema' | 'rsi' | 'volume';

export type IndicatorVisibility = Readonly<Record<IndicatorKey, boolean>>;

export type PanelConfig = {
  readonly id: string;
  readonly symbol: string;
  readonly interval: Interval;
  readonly indicators: IndicatorVisibility;
};

export type DashboardSettings = {
  readonly market: Market;
  readonly layout: Layout;
  readonly panels: readonly PanelConfig[];
  readonly selectedId: string;
  readonly theme: Theme;
};

export type DialogName = 'search' | 'settings' | 'help' | null;
