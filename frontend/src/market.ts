// Illustrative demo simulation only. No exchange connection or execution engine.
export type Market = 'spot' | 'usdm';
export type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export type Bar = {
  readonly time: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
};
export type Instrument = {
  readonly symbol: string;
  readonly name: string;
  readonly base: number;
  readonly change: number;
  readonly precision: number;
};

export const INSTRUMENTS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', base: 67432.8, change: 2.34, precision: 2 },
  { symbol: 'ETHUSDT', name: 'Ethereum', base: 3521.46, change: 1.82, precision: 2 },
  { symbol: 'SOLUSDT', name: 'Solana', base: 172.84, change: 4.67, precision: 2 },
  { symbol: 'BNBUSDT', name: 'BNB', base: 598.32, change: -0.64, precision: 2 },
  { symbol: 'XRPUSDT', name: 'XRP', base: 0.5842, change: 0.93, precision: 4 },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', base: 0.14286, change: -1.27, precision: 5 },
] as const satisfies readonly Instrument[];

export const INTERVALS: readonly Interval[] = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
const SECONDS = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 } as const;

function seedOf(text: string): number {
  let seed = 2166136261;
  for (const character of text) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return seed >>> 0;
}

function noise(seed: number, index: number): number {
  let value = Math.imul(seed ^ index, 1597334677);
  value = Math.imul(value ^ (value >>> 16), 2246822507);
  return ((value ^ (value >>> 13)) >>> 0) / 4294967296;
}

export function getInstrument(symbol: string): Instrument {
  return INSTRUMENTS.find((instrument) => instrument.symbol === symbol) ?? INSTRUMENTS[0];
}

// Times are Unix seconds, rounded to the selected candle interval.
export function generateBars(
  symbol: string,
  market: Market,
  interval: Interval,
  count = 180,
): Bar[] {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('Invalid demo candle count');
  const instrument = getInstrument(symbol);
  const seed = seedOf(`${symbol}:${market}:${interval}`);
  const duration = SECONDS[interval];
  const end = Math.floor(Date.now() / 1000 / duration) * duration;
  const marketBasis = market === 'usdm' ? 1.0004 : 1;
  const bars: Bar[] = [];
  let previous = instrument.base * marketBasis * 0.978;
  for (let index = 0; index < count; index += 1) {
    const open = previous;
    const progress = (index + 1) / Math.max(count, 1);
    const target = instrument.base * marketBasis * (0.978 + 0.022 * progress);
    const close = Math.max(instrument.base * 0.01,
      open + (target - open) * 0.12 + open * (noise(seed, index * 4) - 0.48) * 0.006);
    const wick = open * (0.0004 + noise(seed, index * 4 + 1) * 0.002);
    bars.push({
      time: end - (count - index - 1) * duration,
      open,
      high: Math.max(open, close) + wick,
      low: Math.max(instrument.base * 0.001, Math.min(open, close) - wick),
      close,
      volume: (120000 + noise(seed, index * 4 + 2) * 1600000) / open,
    });
    previous = close;
  }
  return bars;
}

// Each positive twelfth demo tick opens a new candle; inputs stay immutable.
export function advanceBars(
  bars: readonly Bar[],
  symbol: string,
  tick: number,
  interval: Interval,
): Bar[] {
  const last = bars.at(-1);
  if (last === undefined) return [];
  const seed = seedOf(symbol);
  const movement = (noise(seed, tick) - 0.48) * last.close * 0.0012;
  const close = Math.max(last.close * 0.99, last.close + movement);
  const volume = (4000 + noise(seed, tick + 10000) * 24000) / last.close;
  if (tick > 0 && tick % 12 === 0) {
    return [...bars, {
      time: last.time + SECONDS[interval],
      open: last.close,
      high: Math.max(last.close, close),
      low: Math.min(last.close, close),
      close,
      volume,
    }];
  }
  return [...bars.slice(0, -1), {
    ...last,
    high: Math.max(last.high, close),
    low: Math.min(last.low, close),
    close,
    volume: last.volume + volume,
  }];
}

type Point = { time: number; value: number };

export function indicators(bars: readonly Bar[]): { sma: Point[]; ema: Point[]; rsi: Point[] } {
  const sma: Point[] = [];
  const ema: Point[] = [];
  const rsi: Point[] = [];
  let smaSum = 0;
  let emaSum = 0;
  let emaValue = 0;
  let gain = 0;
  let loss = 0;
  let previous: Bar | undefined;
  for (const [index, bar] of bars.entries()) {
    smaSum += bar.close;
    const expired = bars[index - 20];
    if (expired !== undefined) smaSum -= expired.close;
    if (index >= 19) sma.push({ time: bar.time, value: smaSum / 20 });
    if (index < 50) emaSum += bar.close;
    if (index === 49) emaValue = emaSum / 50;
    if (index > 49) emaValue += (bar.close - emaValue) * (2 / 51);
    if (index >= 49) ema.push({ time: bar.time, value: emaValue });
    if (previous !== undefined) {
      const delta = bar.close - previous.close;
      const up = Math.max(delta, 0);
      const down = Math.max(-delta, 0);
      if (index <= 14) {
        gain += up / 14;
        loss += down / 14;
      } else {
        gain = (gain * 13 + up) / 14;
        loss = (loss * 13 + down) / 14;
      }
      if (index >= 14) {
        const value = loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
        rsi.push({ time: bar.time, value });
      }
    }
    previous = bar;
  }
  return { sma, ema, rsi };
}

export function makeBook(price: number, tick: number): {
  bids: { price: number; quantity: number }[];
  asks: { price: number; quantity: number }[];
  imbalance: number;
} {
  const step = price * 0.00008;
  const bids = Array.from({ length: 14 }, (_, index) => ({
    price: price - step * (index + 1),
    quantity: (500 + noise(1701, tick * 29 + index) * 19000) / price,
  }));
  const asks = Array.from({ length: 14 }, (_, index) => ({
    price: price + step * (index + 1),
    quantity: (500 + noise(7919, tick * 29 + index) * 19000) / price,
  }));
  const bidQuantity = bids.reduce((sum, level) => sum + level.quantity, 0);
  const askQuantity = asks.reduce((sum, level) => sum + level.quantity, 0);
  // Bid share of total displayed quantity, in [0, 1].
  return { bids, asks, imbalance: bidQuantity / (bidQuantity + askQuantity) };
}

export function formatPrice(price: number): string {
  const digits = price >= 1 ? 2 : price >= 0.1 ? 4 : 5;
  return price.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
