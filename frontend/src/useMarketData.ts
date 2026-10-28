import { useEffect, useMemo, useState } from 'react';
import { advanceBars, generateBars, INSTRUMENTS } from './market';
import type { Bar, Market } from './market';
import type { PanelConfig } from './types';

const HISTORY_LIMIT = 240;
const INITIAL_BARS = 180;

export type PanelDataset = {
  readonly key: string;
  readonly tick: number;
  readonly bars: readonly Bar[];
};

export function useMarketData(
  panels: readonly PanelConfig[],
  market: Market,
  tick: number,
): Readonly<Record<string, PanelDataset>> {
  const [datasets, setDatasets] = useState<Readonly<Record<string, PanelDataset>>>({});

  useEffect(() => {
    setDatasets((current) => {
      const next: Record<string, PanelDataset> = {};
      for (const panel of panels) {
        const key = `${panel.symbol}:${market}:${panel.interval}`;
        const previous = current[panel.id];
        if (previous?.key === key && previous.tick === tick) {
          next[panel.id] = previous;
        } else if (previous?.key === key) {
          next[panel.id] = {
            key,
            tick,
            bars: advanceBars(previous.bars, panel.symbol, tick, panel.interval).slice(-HISTORY_LIMIT),
          };
        } else {
          next[panel.id] = {
            key,
            tick,
            bars: generateBars(panel.symbol, market, panel.interval, INITIAL_BARS),
          };
        }
      }
      return next;
    });
  }, [panels, market, tick]);

  return datasets;
}

export function useWatchlistPrices(market: Market, tick: number): Readonly<Record<string, number>> {
  return useMemo(() => {
    const prices: Record<string, number> = {};
    for (const instrument of INSTRUMENTS) {
      const initial = generateBars(instrument.symbol, market, '1m', 80);
      const bars = tick === 0 ? initial : advanceBars(initial, instrument.symbol, tick, '1m');
      const last = bars.at(-1);
      prices[instrument.symbol] = last?.close ?? instrument.base;
    }
    return prices;
  }, [market, tick]);
}
