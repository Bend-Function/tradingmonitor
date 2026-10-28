import { expect, test } from 'bun:test';
import { matchingDatasets } from './useMarketData';
import type { PanelDataset } from './useMarketData';

const panel = { id: 'chart-a', symbol: 'DOGEUSDT', interval: '15m' as const };
const previous: PanelDataset = {
  key: 'BTCUSDT:spot:15m',
  tick: 4,
  bars: [{ time: 1700000000, open: 67000, high: 68000, low: 66000, close: 67500, volume: 1 }],
};

test('does not expose the prior symbol history during a symbol-change render', () => {
  const datasets = { [panel.id]: previous };
  expect(matchingDatasets([panel], 'spot', datasets)[panel.id]).toBeUndefined();
  expect(datasets[panel.id]).toBe(previous);
});

test('retains a matching dataset and its candle references', () => {
  const current: PanelDataset = { ...previous, key: 'DOGEUSDT:spot:15m' };
  expect(matchingDatasets([panel], 'spot', { [panel.id]: current })[panel.id]).toBe(current);
});

test('does not mix history across markets or intervals', () => {
  const current: PanelDataset = { ...previous, key: 'DOGEUSDT:spot:15m' };
  expect(matchingDatasets([panel], 'usdm', { [panel.id]: current })[panel.id]).toBeUndefined();
  expect(matchingDatasets([{ ...panel, interval: '1h' }], 'spot', { [panel.id]: current })[panel.id]).toBeUndefined();
});

test('does not expose datasets belonging to removed panels', () => {
  expect(matchingDatasets([], 'spot', { [panel.id]: previous })).toEqual({});
});
