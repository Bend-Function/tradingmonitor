import type { Market } from './market';
import type {
  PanelConfig,
  WidgetPosition,
  WorkspaceWidget,
} from './types';

export const GRID_COLUMNS = 12;
export const PURE_CHART_ROWS = 6;
export const RESEARCH_CHART_ROWS = 12;

function position(i: string, x: number, y: number, w: number, h: number): WidgetPosition {
  return { i, x, y, w, h };
}

function isResearch(panel: PanelConfig): boolean {
  return panel.indicators.rsi || panel.indicators.cci;
}

export function positionsOverlap(a: WidgetPosition, b: WidgetPosition): boolean {
  return a.i !== b.i
    && a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y;
}

export function hasWidgetOverlap(widgets: readonly WorkspaceWidget[]): boolean {
  const visible = widgets.filter((widget) => widget.visible);
  return visible.some((widget, index) => (
    visible.slice(index + 1).some((other) => positionsOverlap(widget.position, other.position))
  ));
}

export function normalizePosition(value: WidgetPosition): WidgetPosition {
  const integer = (candidate: number, fallback: number): number => (
    Number.isFinite(candidate) ? Math.round(candidate) : fallback
  );
  const w = Math.min(GRID_COLUMNS, Math.max(1, integer(value.w, 1)));
  const x = Math.min(GRID_COLUMNS - w, Math.max(0, integer(value.x, 0)));
  return {
    i: value.i,
    x,
    y: Math.max(0, integer(value.y, 0)),
    w,
    h: Math.max(1, integer(value.h, 1)),
  };
}

// Place priority items first so an expanding chart moves its neighbors, not itself.
export function resolveWidgetOverlaps(
  widgets: readonly WorkspaceWidget[],
  priorityId?: string,
): readonly WorkspaceWidget[] {
  const ordered = widgets
    .filter((widget) => widget.visible)
    .map((widget, index) => ({ widget, index }))
    .sort((a, b) => {
      if (a.widget.id === priorityId) return -1;
      if (b.widget.id === priorityId) return 1;
      return a.widget.position.y - b.widget.position.y
        || a.widget.position.x - b.widget.position.x
        || a.index - b.index;
    });
  const placed = new Map<string, WorkspaceWidget>();
  for (const { widget } of ordered) {
    let candidate = normalizePosition(widget.position);
    while ([...placed.values()].some((other) => positionsOverlap(candidate, other.position))) {
      const nextY = Math.min(...[...placed.values()]
        .filter((other) => positionsOverlap(candidate, other.position))
        .map((other) => other.position.y + other.position.h));
      candidate = { ...candidate, y: nextY };
    }
    placed.set(widget.id, { ...widget, position: candidate });
  }
  return widgets.map((widget) => placed.get(widget.id) ?? widget);
}

export function createWorkspaceWidgets(
  panels: readonly PanelConfig[],
  market: Market,
): readonly WorkspaceWidget[] {
  const charts: WorkspaceWidget[] = panels.map((panel, index) => {
    const height = isResearch(panel) ? RESEARCH_CHART_ROWS : PURE_CHART_ROWS;
    const chartPosition = index === 0
      ? position(panel.id, 0, 0, 5, height)
      : index === 1
        ? position(panel.id, 5, 0, 4, height)
        : index === 2
          ? position(panel.id, 5, 6, 4, height)
          : position(panel.id, (index % 2) * 6, 12 + Math.floor((index - 3) / 2) * 6, 6, height);
    return { id: panel.id, kind: 'chart', visible: true, position: chartPosition };
  });
  const utilities: WorkspaceWidget[] = [
    {
      id: 'watchlist-main', kind: 'watchlist', symbol: panels[0]?.symbol ?? 'BTCUSDT', market,
      visible: true, position: position('watchlist-main', 9, 0, 3, 6),
    },
    {
      id: 'depth-main', kind: 'depth', symbol: panels[0]?.symbol ?? 'BTCUSDT', market,
      visible: true, position: position('depth-main', 9, 6, 3, 6),
    },
    ...(['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const).map((symbol, index): WorkspaceWidget => ({
      id: `orderbook-${symbol.toLowerCase()}`,
      kind: 'orderbook',
      symbol,
      market,
      visible: true,
      position: position(`orderbook-${symbol.toLowerCase()}`, index * 4, 12, 4, 8),
    })),
  ];
  return resolveWidgetOverlaps([...charts, ...utilities]);
}

export function ensureResearchHeight(
  widgets: readonly WorkspaceWidget[],
  id: string,
): readonly WorkspaceWidget[] {
  const chart = widgets.find((widget) => widget.id === id && widget.kind === 'chart');
  if (chart === undefined || chart.position.h >= RESEARCH_CHART_ROWS) return widgets;
  return resolveWidgetOverlaps(widgets.map((widget) => (
    widget.id === id
      ? { ...widget, position: { ...widget.position, h: RESEARCH_CHART_ROWS } }
      : widget
  )), id);
}

export function applyWidgetLayout(
  widgets: readonly WorkspaceWidget[],
  layout: readonly WidgetPosition[],
): readonly WorkspaceWidget[] {
  const positions = new Map(layout.map((item) => [item.i, item]));
  let changed = false;
  const next = widgets.map((widget) => {
    const item = positions.get(widget.id);
    if (item === undefined) return widget;
    const normalized = normalizePosition({ ...item, i: widget.id });
    const previous = widget.position;
    if (previous.x === normalized.x && previous.y === normalized.y
      && previous.w === normalized.w && previous.h === normalized.h) return widget;
    changed = true;
    return { ...widget, position: normalized };
  });
  return changed ? next : widgets;
}

export function nextWidgetPosition(widgets: readonly WorkspaceWidget[], id: string): WidgetPosition {
  const bottom = widgets.reduce((max, widget) => (
    Math.max(max, widget.position.y + widget.position.h)
  ), 0);
  return position(id, 0, bottom, 4, 8);
}
