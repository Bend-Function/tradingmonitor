import { expect, test } from 'bun:test';
import { createDefaultSettings, parseBlueprintStore } from './settings';
import {
  applyWidgetLayout,
  ensureResearchHeight,
  hasWidgetOverlap,
  normalizePosition,
  resolveWidgetOverlaps,
} from './workspace';

test('mixed preset has one research column and two half-height charts sharing another', () => {
  const settings = createDefaultSettings();
  const charts = settings.widgets.filter((widget) => widget.kind === 'chart');
  expect(charts.map((widget) => widget.position.h)).toEqual([12, 6, 6]);
  expect(charts[1].position.x).toBe(charts[2].position.x);
  expect(charts[1].position.y + charts[1].position.h).toBe(charts[2].position.y);
  expect(hasWidgetOverlap(settings.widgets)).toBe(false);
});

test('growing an indicator chart keeps its position and moves conflicting neighbors', () => {
  const settings = createDefaultSettings();
  const chart = settings.widgets[1];
  const updated = ensureResearchHeight(settings.widgets, chart.id);
  const expanded = updated.find((widget) => widget.id === chart.id);
  expect(expanded?.position).toEqual({ ...chart.position, h: 12 });
  expect(hasWidgetOverlap(updated)).toBe(false);
  expect(settings.widgets[1].position.h).toBe(6);
});

test('unchanged grid callbacks retain the same workspace reference', () => {
  const { widgets } = createDefaultSettings();
  expect(applyWidgetLayout(widgets, widgets.map((widget) => widget.position))).toBe(widgets);
});

test('grid positions remain inside twelve proportional columns', () => {
  expect(normalizePosition({ i: 'book', x: 99, y: -4, w: 4.2, h: 0 })).toEqual({
    i: 'book', x: 8, y: 0, w: 4, h: 1,
  });
});

test('hidden widgets do not displace a visible container occupying their former space', () => {
  const settings = createDefaultSettings();
  const book = settings.widgets.find((widget) => widget.kind === 'orderbook');
  if (book === undefined) throw new Error('preset must include an order book');
  const widgets = settings.widgets.map((widget) => (
    widget.id === settings.selectedId ? { ...widget, visible: false }
      : widget.id === book.id ? { ...widget, position: { ...widget.position, x: 0, y: 0 } }
        : widget
  ));
  const resolved = resolveWidgetOverlaps(widgets);
  expect(resolved.find((widget) => widget.id === book.id)?.position.y).toBe(0);
  expect(resolved.find((widget) => widget.id === settings.selectedId)?.position).toEqual(
    settings.widgets[0].position,
  );
});

test('v1 workspaces migrate without losing symbols or inventing a CCI indicator', () => {
  const legacy = {
    market: 'usdm',
    layout: 1,
    theme: 'light',
    selectedId: 'legacy-chart',
    panels: [{
      id: 'legacy-chart', symbol: 'ETHUSDT', interval: '4h' as const,
      indicators: { sma: false, ema: true, rsi: true, volume: true },
    }],
  };
  const migrated = parseBlueprintStore([{ name: '旧工作区', settings: legacy }])[0]?.settings;
  expect(migrated?.version).toBe(2);
  expect(migrated?.panels[0]).toEqual({
    ...legacy.panels[0], indicators: { ...legacy.panels[0].indicators, cci: false },
  });
  expect(migrated?.market).toBe('usdm');
  expect(migrated?.widgets.some((widget) => widget.kind === 'chart')).toBe(true);
});

test('named blueprint roundtrip preserves layout, visibility and independent book symbols', () => {
  const original = createDefaultSettings();
  const settings = {
    ...original,
    widgets: original.widgets.map((widget) => (
      widget.kind === 'watchlist' ? { ...widget, visible: false } : widget
    )),
  };
  const result = parseBlueprintStore(JSON.parse(JSON.stringify([{ name: '研究布局', settings }])));
  expect(result).toEqual([{ name: '研究布局', settings }]);
});

test('blueprint parsing rejects orphan chart IDs and duplicate widget IDs', () => {
  const settings = createDefaultSettings();
  const orphan = {
    ...settings,
    widgets: settings.widgets.map((widget, index) => (
      index === 0 ? { ...widget, id: 'missing', position: { ...widget.position, i: 'missing' } } : widget
    )),
  };
  expect(parseBlueprintStore([{ name: 'orphan', settings: orphan }])).toEqual([]);
  expect(parseBlueprintStore([{
    name: 'duplicate',
    settings: { ...settings, widgets: [...settings.widgets, settings.widgets[0]] },
  }])).toEqual([]);
});
