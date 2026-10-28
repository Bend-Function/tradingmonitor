import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { advanceBars, generateBars, indicators, INSTRUMENTS, INTERVALS, makeBook } from './market';
import type { Bar } from './market';

afterEach(() => {
  Date.now = originalNow;
});
const originalNow = Date.now;
const NOW = 1793145678000;

function sequence(closes: readonly number[]): Bar[] {
  return closes.map((close, index) => ({
    time: 1700000000 + index * 60,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
  }));
}

function assertIntegrity(bars: readonly Bar[]): void {
  let previousTime = -Infinity;
  for (const bar of bars) {
    expect(Object.values(bar).every(Number.isFinite)).toBe(true);
    expect(bar.time).toBeGreaterThan(previousTime);
    expect(bar.low).toBeGreaterThan(0);
    expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close));
    expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close));
    expect(bar.volume).toBeGreaterThanOrEqual(0);
    previousTime = bar.time;
  }
}

describe('demo candles', () => {
  it('repeats its candles when the clock remains in one interval', () => {
    // Given a fixed clock and the same simulation inputs.
    const clock = spyOn(Date, 'now').mockReturnValue(NOW);
    const first = generateBars('BTCUSDT', 'spot', '5m');
    clock.mockReturnValue(NOW + 1000);
    // When generating the same market within that candle.
    const second = generateBars('BTCUSDT', 'spot', '5m');
    // Then all generated prices, quantities and times are identical.
    expect(second).toEqual(first);
    expect(second).toHaveLength(180);
    expect(second.at(-1)?.time).toBe(Math.floor(NOW / 1000 / 300) * 300);
  });

  it('keeps valid OHLC and chronological spacing across symbols and intervals', () => {
    // Given the supported instruments and intervals.
    spyOn(Date, 'now').mockReturnValue(NOW);
    const durations = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 } as const;
    // When generating both demo markets.
    for (const instrument of INSTRUMENTS) {
      for (const interval of INTERVALS) {
        for (const market of ['spot', 'usdm'] as const) {
          const bars = generateBars(instrument.symbol, market, interval);
          // Then candles preserve numerical and temporal invariants.
          assertIntegrity(bars);
          expect(bars.at(-1)?.time).toBe(Math.floor(NOW / 1000 / durations[interval]) * durations[interval]);
          expect(new Set(bars.slice(1).map((bar, i) => bar.time - (bars[i]?.time ?? 0)))).toEqual(new Set([durations[interval]]));
        }
      }
    }
  });

  it('changes the path when the market or symbol changes', () => {
    // Given a stable clock.
    spyOn(Date, 'now').mockReturnValue(NOW);
    // When generating distinct instruments and markets.
    const spot = generateBars('BTCUSDT', 'spot', '1m');
    const futures = generateBars('BTCUSDT', 'usdm', '1m');
    const ether = generateBars('ETHUSDT', 'spot', '1m');
    // Then paths differ.
    expect(spot).not.toEqual(futures);
    expect(spot).not.toEqual(ether);
  });

  it('updates the active candle without changing prior candles or inputs', () => {
    // Given a sequence with a known active candle.
    const bars = sequence([100, 101, 102]);
    const before = structuredClone(bars);
    // When an ordinary tick arrives.
    const updated = advanceBars(bars, 'BTCUSDT', 1, '1m');
    // Then only the final candle changes coherently.
    expect(bars).toEqual(before);
    expect(updated.slice(0, -1)).toEqual(bars.slice(0, -1));
    expect(updated).toHaveLength(3);
    expect(updated.at(-1)?.open).toBe(102);
    expect(updated.at(-1)?.volume).toBeGreaterThan(1);
    assertIntegrity(updated);
  });

  it('appends a continuous new candle on the twelfth tick', () => {
    // Given one active candle.
    const bars = sequence([100]);
    // When the twelfth tick arrives.
    const updated = advanceBars(bars, 'BTCUSDT', 12, '5m');
    // Then a new candle starts at the previous close and advances by one interval.
    expect(updated).toHaveLength(2);
    expect(updated[0]).toEqual(bars[0]);
    expect(updated.at(-1)?.open).toBe(100);
    expect(updated.at(-1)?.time).toBe(1700000300);
    assertIntegrity(updated);
  });
});

describe('indicators', () => {
  it('calculates SMA20 from a known increasing sequence after warmup', () => {
    // Given closing prices one through twenty-five.
    const bars = sequence(Array.from({ length: 25 }, (_, index) => index + 1));
    // When computing indicators.
    const { sma } = indicators(bars);
    // Then the first average is 10.5 and each next window increases by one.
    expect(sma.map((point) => point.value)).toEqual([10.5, 11.5, 12.5, 13.5, 14.5, 15.5]);
    expect(sma[0]?.time).toBe(bars[19]?.time);
  });

  it('seeds EMA50 with an SMA and applies exponential weighting thereafter', () => {
    // Given fifty closes at ten followed by one close at sixty-one.
    const bars = sequence([...Array.from({ length: 50 }, () => 10), 61]);
    // When computing indicators.
    const { ema } = indicators(bars);
    // Then only two valid points exist and the new close receives weight 2/51.
    expect(ema).toEqual([
      { time: 1700002940, value: 10 },
      { time: 1700003000, value: 12 },
    ]);
  });

  it('omits all fabricated warmup points on short input', () => {
    // Given fewer than fourteen price changes.
    const bars = sequence(Array.from({ length: 14 }, (_, index) => index + 1));
    // When computing indicators.
    const result = indicators(bars);
    // Then none of the indicators has sufficient observations.
    expect(result).toEqual({ sma: [], ema: [], rsi: [], cci: [] });
  });

  it('calculates CCI20 from typical prices after twenty observations', () => {
    const bars = sequence(Array.from({ length: 25 }, (_, index) => index + 1));
    const { cci } = indicators(bars);
    expect(cci).toHaveLength(6);
    expect(cci[0]?.time).toBe(bars[19]?.time);
    for (const point of cci) expect(point.value).toBeCloseTo(126.66666666666667, 10);
  });

  it('uses high and low as well as close for CCI20', () => {
    const bars = sequence(Array.from({ length: 20 }, (_, index) => index + 1));
    bars[19] = { ...bars[19], high: 80, low: 20 };
    expect(indicators(bars).cci[0]?.value).toBeCloseTo(28.5 / (0.015 * 6.05), 10);
  });

  it('returns finite zero CCI for flat fractional prices', () => {
    const bars = sequence(Array.from({ length: 24 }, () => 0.1));
    expect(indicators(bars).cci.map((point) => point.value)).toEqual([0, 0, 0, 0, 0]);
  });

  it('reports RSI100 for a consistently rising sequence', () => {
    // Given twenty consecutive rising closes.
    const bars = sequence(Array.from({ length: 20 }, (_, index) => index + 1));
    // When computing indicators.
    const { rsi } = indicators(bars);
    // Then RSI begins after fourteen changes and remains 100.
    expect(rsi).toHaveLength(6);
    expect(rsi[0]?.time).toBe(bars[14]?.time);
    expect(rsi.every((point) => point.value === 100)).toBe(true);
  });

  it('reports RSI0 for a consistently falling sequence', () => {
    // Given twenty consecutive falling closes.
    const bars = sequence(Array.from({ length: 20 }, (_, index) => 30 - index));
    // When computing indicators.
    const { rsi } = indicators(bars);
    // Then RSI remains zero after its warmup.
    expect(rsi).toHaveLength(6);
    expect(rsi.every((point) => point.value === 0)).toBe(true);
  });

  it('uses Wilder smoothing after the initial fourteen changes', () => {
    // Given fourteen one-point gains followed by a fourteen-point loss.
    const bars = sequence([...Array.from({ length: 15 }, (_, index) => 100 + index), 100]);
    // When computing indicators.
    const { rsi } = indicators(bars);
    // Then the smoothed average gain is 13/14 and average loss is 1.
    expect(rsi.at(-1)?.value).toBeCloseTo(100 - 100 / (1 + 13 / 14), 10);
  });
});

describe('demo order book', () => {
  it('creates fourteen positive sorted levels on each side without crossing', () => {
    // Given a demo mid price.
    const price = 67432.8;
    // When generating the book.
    const { bids, asks } = makeBook(price, 42);
    // Then bids descend and asks ascend away from the midpoint.
    expect(bids).toHaveLength(14);
    expect(asks).toHaveLength(14);
    let previousBid = price;
    let previousAsk = price;
    for (const [index, bid] of bids.entries()) {
      const ask = asks[index];
      expect(bid.price).toBeGreaterThan(0);
      expect(bid.price).toBeLessThan(previousBid);
      expect(bid.quantity).toBeGreaterThan(0);
      expect(ask?.price).toBeGreaterThan(previousAsk);
      expect(ask?.quantity).toBeGreaterThan(0);
      previousBid = bid.price;
      previousAsk = ask?.price ?? previousAsk;
    }
  });

  it('reports the displayed bid quantity share as imbalance', () => {
    // Given a deterministic book.
    const book = makeBook(172.84, 7);
    const bidQuantity = book.bids.reduce((sum, bid) => sum + bid.quantity, 0);
    const askQuantity = book.asks.reduce((sum, ask) => sum + ask.quantity, 0);
    // When comparing the displayed totals with the reported imbalance.
    const share = bidQuantity / (bidQuantity + askQuantity);
    // Then the ratio matches and repeated input preserves the book.
    expect(book.imbalance).toBeCloseTo(share, 12);
    expect(book.imbalance).toBeGreaterThan(0);
    expect(book.imbalance).toBeLessThan(1);
    expect(makeBook(172.84, 7)).toEqual(book);
    expect(makeBook(172.84, 8)).not.toEqual(book);
  });
});
