import type { Interval, Market } from './market';

export const LAYOUTS = [1, 2, 4, 6] as const;
export type Layout = (typeof LAYOUTS)[number];
export type Theme = 'dark' | 'light';
export type IndicatorKey = 'sma' | 'ema' | 'rsi' | 'cci' | 'volume';

export type IndicatorVisibility = Readonly<Record<IndicatorKey, boolean>>;

export type PanelConfig = {
  readonly id: string;
  readonly symbol: string;
  readonly interval: Interval;
  readonly indicators: IndicatorVisibility;
};

export type WidgetPosition = {
  readonly i: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export type UtilityWidgetKind = 'watchlist' | 'orderbook' | 'depth';
export type WidgetKind = 'chart' | UtilityWidgetKind;

type WidgetBase = {
  readonly id: string;
  readonly visible: boolean;
  readonly position: WidgetPosition;
};

export type ChartWidget = WidgetBase & {
  readonly kind: 'chart';
};

export type UtilityWidget = WidgetBase & {
  readonly kind: UtilityWidgetKind;
  readonly symbol: string;
  readonly market: Market;
};

export type WorkspaceWidget = ChartWidget | UtilityWidget;

export type WorkspaceBlueprint = {
  readonly name: string;
  readonly settings: DashboardSettings;
};

export type DashboardSettings = {
  readonly version: 2;
  readonly market: Market;
  readonly layout: Layout;
  readonly panels: readonly PanelConfig[];
  readonly selectedId: string;
  readonly theme: Theme;
  readonly widgets: readonly WorkspaceWidget[];
  readonly layoutLocked: boolean;
};

export type DialogName = 'search' | 'settings' | 'help' | null;
