import { useMemo } from 'react';
import { X } from 'lucide-react';
import { formatPrice, getInstrument, INSTRUMENTS, makeBook } from '../market';
import type { Market } from '../market';
import type { PanelConfig } from '../types';

const BOOK_ROWS = 8;
const DEPTH_WIDTH = 280;
const DEPTH_HEIGHT = 72;
const DEPTH_PADDING = 4;
const DEPTH_CENTER = DEPTH_WIDTH / 2;

type QuantityLevel = {
  readonly price: number;
  readonly quantity: number;
};

export type InspectorProps = {
  readonly panel: PanelConfig;
  readonly market: Market;
  readonly price: number;
  readonly tick: number;
  readonly watchPrices: Readonly<Record<string, number>>;
  readonly onClose: () => void;
  readonly onSelectInstrument: (symbol: string) => void;
};

function formatQuantity(quantity: number): string {
  return quantity.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

function signedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function cumulative(levels: readonly QuantityLevel[]): number[] {
  let total = 0;
  return levels.map((level) => {
    total += level.quantity;
    return total;
  });
}

function depthPoints(totals: readonly number[], maximum: number, side: 'bid' | 'ask'): string {
  return totals.map((total, index) => {
    const distance = ((index + 1) / Math.max(totals.length, 1)) * (DEPTH_CENTER - DEPTH_PADDING);
    const x = side === 'bid' ? DEPTH_CENTER - distance : DEPTH_CENTER + distance;
    const y = DEPTH_HEIGHT - DEPTH_PADDING - (total / maximum) * (DEPTH_HEIGHT - DEPTH_PADDING * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

function DepthChart({ bids, asks }: { readonly bids: readonly QuantityLevel[]; readonly asks: readonly QuantityLevel[] }) {
  const bidTotals = cumulative(bids);
  const askTotals = cumulative(asks);
  const maximum = Math.max(bidTotals.at(-1) ?? 1, askTotals.at(-1) ?? 1, 1);
  const bidPoints = depthPoints(bidTotals, maximum, 'bid');
  const askPoints = depthPoints(askTotals, maximum, 'ask');
  const bidArea = bidPoints.length > 0
    ? `M ${DEPTH_CENTER} ${DEPTH_HEIGHT} L ${bidPoints} L ${DEPTH_PADDING} ${DEPTH_HEIGHT} Z`
    : '';
  const askArea = askPoints.length > 0
    ? `M ${DEPTH_CENTER} ${DEPTH_HEIGHT} L ${askPoints} L ${DEPTH_WIDTH - DEPTH_PADDING} ${DEPTH_HEIGHT} Z`
    : '';
  return (
    <svg
      className="depth-chart"
      viewBox={`0 0 ${DEPTH_WIDTH} ${DEPTH_HEIGHT}`}
      role="img"
      aria-label="模拟买卖盘累计深度图，左侧为买盘，右侧为卖盘"
      preserveAspectRatio="none"
    >
      <line x1={DEPTH_CENTER} x2={DEPTH_CENTER} y1={DEPTH_PADDING} y2={DEPTH_HEIGHT} className="depth-chart__mid" />
      {bidArea && <path d={bidArea} className="depth-chart__bid-area" />}
      {askArea && <path d={askArea} className="depth-chart__ask-area" />}
      {bidPoints && <polyline points={bidPoints} className="depth-chart__bid-line" />}
      {askPoints && <polyline points={askPoints} className="depth-chart__ask-line" />}
    </svg>
  );
}

export function Inspector({
  panel,
  market,
  price,
  tick,
  watchPrices,
  onClose,
  onSelectInstrument,
}: InspectorProps) {
  const instrument = getInstrument(panel.symbol);
  const book = useMemo(() => makeBook(price, tick), [price, tick]);
  const asks = book.asks.slice(0, BOOK_ROWS).reverse();
  const bids = book.bids.slice(0, BOOK_ROWS);
  const maxQuantity = Math.max(...asks.map((level) => level.quantity), ...bids.map((level) => level.quantity), 1);
  const bestBid = book.bids[0]?.price ?? price;
  const bestAsk = book.asks[0]?.price ?? price;
  const bidShare = book.imbalance * 100;

  return (
    <aside className="inspector" aria-label="市场观察与模拟盘口">
      <div className="inspector__mobile-header">
        <div>
          <span className="section-eyebrow">MARKET INSPECTOR</span>
          <h2>市场检查器</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="关闭市场检查器" title="关闭">
          <X />
        </button>
      </div>

      <section className="inspector-section watchlist-section">
        <div className="section-heading">
          <h2>自选列表</h2>
          <span className="numeric muted">06</span>
        </div>
        <div className="watchlist">
          {INSTRUMENTS.map((item) => {
            const active = item.symbol === panel.symbol;
            return (
              <button
                type="button"
                className={`watchlist-row${active ? ' is-active' : ''}`}
                key={item.symbol}
                onClick={() => onSelectInstrument(item.symbol)}
                aria-pressed={active}
                aria-label={`在当前面板显示 ${item.name}`}
              >
                <span className="watchlist-row__name">
                  <strong className="numeric">{item.symbol}</strong>
                  <small>{item.name}</small>
                </span>
                <span className="watchlist-row__quote numeric">
                  <strong>{formatPrice(watchPrices[item.symbol] ?? item.base)}</strong>
                  <small className={item.change >= 0 ? 'positive' : 'negative'}>{signedPercent(item.change)}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="inspector-section instrument-inspector">
        <div className="section-heading">
          <div>
            <span className="section-eyebrow">SELECTED / {market === 'spot' ? 'SPOT' : 'USDⓈ-M'}</span>
            <h2 className="numeric">{instrument.symbol}</h2>
          </div>
          <span className="badge badge--warning">模拟盘口</span>
        </div>
        <div className="inspector-price numeric">
          <strong>{formatPrice(price)}</strong>
          <span className={instrument.change >= 0 ? 'positive' : 'negative'}>{signedPercent(instrument.change)} <small>24h</small></span>
        </div>
      </section>

      <section className="inspector-section depth-section">
        <div className="section-heading">
          <h2>累计深度</h2>
          <span className="muted">10 档</span>
        </div>
        <DepthChart bids={book.bids.slice(0, 10)} asks={book.asks.slice(0, 10)} />
        <div className="depth-labels numeric"><span className="positive">买盘</span><span className="negative">卖盘</span></div>
        <div className="balance-label"><span>买盘占比</span><strong className="numeric">{bidShare.toFixed(1)}%</strong></div>
        <div className="balance-bar" aria-label={`买盘占比 ${bidShare.toFixed(1)}%，卖盘占比 ${(100 - bidShare).toFixed(1)}%`}>
          <span className="balance-bar__bid" style={{ width: `${bidShare}%` }} />
          <span className="balance-bar__ask" style={{ width: `${100 - bidShare}%` }} />
        </div>
      </section>

      <section className="inspector-section book-section">
        <div className="section-heading">
          <h2>订单簿</h2>
          <span className="muted">8 档</span>
        </div>
        <div className="book-head numeric muted"><span>价格 (USDT)</span><span>数量</span></div>
        <div className="book-rows book-rows--asks">
          {asks.map((level) => (
            <div className="book-row numeric" key={`ask-${level.price}`}>
              <span className="book-row__depth book-row__depth--ask" style={{ width: `${(level.quantity / maxQuantity) * 100}%` }} />
              <span className="negative">{formatPrice(level.price)}</span>
              <span>{formatQuantity(level.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="book-spread numeric">
          <strong>{formatPrice(price)}</strong>
          <span>价差 {formatPrice(bestAsk - bestBid)}</span>
        </div>
        <div className="book-rows book-rows--bids">
          {bids.map((level) => (
            <div className="book-row numeric" key={`bid-${level.price}`}>
              <span className="book-row__depth book-row__depth--bid" style={{ width: `${(level.quantity / maxQuantity) * 100}%` }} />
              <span className="positive">{formatPrice(level.price)}</span>
              <span>{formatQuantity(level.quantity)}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
