import { useMemo } from 'react';
import {
  advanceBars,
  formatPrice,
  generateBars,
  getInstrument,
  INSTRUMENTS,
  makeBook,
} from '../market';
import type { Market } from '../market';
import type { UtilityWidget } from '../types';

type UtilityWidgetProps = {
  readonly widget: UtilityWidget;
  readonly tick: number;
  readonly onChange: (update: { readonly symbol?: string; readonly market?: Market }) => void;
};

function SymbolMarketControls({ widget, onChange }: Pick<UtilityWidgetProps, 'widget' | 'onChange'>) {
  return (
    <div className="utility-controls">
      <label>
        <span className="sr-only">组件标的</span>
        <select
          className="workspace-select numeric"
          value={widget.symbol}
          onChange={(event) => onChange({ symbol: event.target.value })}
          aria-label="组件标的"
        >
          {INSTRUMENTS.map((instrument) => (
            <option value={instrument.symbol} key={instrument.symbol}>{instrument.symbol}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">组件市场</span>
        <select
          className="workspace-select"
          value={widget.market}
          onChange={(event) => onChange({ market: event.target.value as Market })}
          aria-label="组件市场"
        >
          <option value="spot">现货</option>
          <option value="usdm">U 本位</option>
        </select>
      </label>
    </div>
  );
}

function useUtilityPrice(symbol: string, market: Market, tick: number): number {
  return useMemo(() => {
    const bars = advanceBars(generateBars(symbol, market, '1m', 90), symbol, tick, '1m');
    return bars.at(-1)?.close ?? getInstrument(symbol).base;
  }, [market, symbol, tick]);
}

function useUtilityBook(widget: UtilityWidget, tick: number) {
  const price = useUtilityPrice(widget.symbol, widget.market, tick);
  const book = useMemo(() => makeBook(price, tick), [price, tick]);
  return { book, price, instrument: getInstrument(widget.symbol) };
}

export function WatchlistWidget({ widget, tick, onChange }: UtilityWidgetProps) {
  const prices = useMemo(() => Object.fromEntries(INSTRUMENTS.map((instrument) => {
    const bars = advanceBars(generateBars(instrument.symbol, widget.market, '15m', 90), instrument.symbol, tick, '15m');
    return [instrument.symbol, {
      price: bars.at(-1)?.close ?? instrument.base,
      change: instrument.change + (tick % 7 - 3) * 0.02,
    }];
  })), [tick, widget.market]);

  return (
    <section className="utility-widget watchlist-section" aria-label="独立自选列表">
      <div className="utility-controls">
        <span className="utility-controls__current numeric">{widget.symbol}</span>
        <label>
          <span className="sr-only">自选市场</span>
          <select
            className="workspace-select"
            value={widget.market}
            onChange={(event) => onChange({ market: event.target.value as Market })}
            aria-label="自选市场"
          >
            <option value="spot">现货</option>
            <option value="usdm">U 本位</option>
          </select>
        </label>
      </div>
      <div className="watchlist">
        {INSTRUMENTS.map((instrument) => {
          const quote = prices[instrument.symbol];
          return (
            <button
              type="button"
              className={`watchlist-row${instrument.symbol === widget.symbol ? ' is-active' : ''}`}
              key={instrument.symbol}
              aria-pressed={instrument.symbol === widget.symbol}
              aria-label={`在当前图表显示 ${instrument.name}`}
              onClick={() => onChange({ symbol: instrument.symbol })}
            >
              <span className="watchlist-row__name">
                <strong>{instrument.symbol}</strong>
                <small>{instrument.name}</small>
              </span>
              <span className="watchlist-row__quote">
                <strong>{formatPrice(quote.price)}</strong>
                <small className={quote.change >= 0 ? 'positive' : 'negative'}>
                  {quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)}%
                </small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function OrderBookWidget({ widget, tick, onChange }: UtilityWidgetProps) {
  const { book, price, instrument } = useUtilityBook(widget, tick);
  const maximumQuantity = Math.max(
    ...book.asks.slice(0, 7).map((level) => level.quantity),
    ...book.bids.slice(0, 7).map((level) => level.quantity),
  );
  return (
    <section className="utility-widget book-section" aria-label={`${widget.symbol} 独立盘口`}>
      <SymbolMarketControls widget={widget} onChange={onChange} />
      <div className="inspector-price">
        <strong className="numeric">{formatPrice(price)}</strong>
        <span className={instrument.change >= 0 ? 'positive' : 'negative'}>
          {instrument.change >= 0 ? '+' : ''}{instrument.change.toFixed(2)}%
        </span>
        <small>{widget.market === 'spot' ? '现货' : 'U 本位'}独立报价</small>
      </div>
      <div className="book-head numeric"><span>价格(USDT)</span><span>数量({instrument.symbol.replace('USDT', '')})</span></div>
      <div className="book-rows book-rows--asks">
        {book.asks.slice(0, 7).reverse().map((level, index) => (
          <div className="book-row numeric" key={`ask-${index}`}>
            <div className="book-row__depth book-row__depth--ask" style={{ width: `${level.quantity / maximumQuantity * 100}%` }} />
            <span className="negative">{formatPrice(level.price)}</span><span>{level.quantity.toFixed(3)}</span>
          </div>
        ))}
      </div>
      <div className="book-spread">
        <strong className="numeric">{formatPrice(price)}</strong>
        <span>价差 {formatPrice(book.asks[0].price - book.bids[0].price)}</span>
      </div>
      <div className="book-rows book-rows--bids">
        {book.bids.slice(0, 7).map((level, index) => (
          <div className="book-row numeric" key={`bid-${index}`}>
            <div className="book-row__depth book-row__depth--bid" style={{ width: `${level.quantity / maximumQuantity * 100}%` }} />
            <span className="positive">{formatPrice(level.price)}</span><span>{level.quantity.toFixed(3)}</span>
          </div>
        ))}
      </div>
      <div className="imbalance-track" aria-label={`买方占比 ${(book.imbalance * 100).toFixed(1)}%`}>
        <div className="imbalance-track__bid" style={{ width: `${book.imbalance * 100}%` }} />
      </div>
      <div className="imbalance-labels">
        <span>买方 {(book.imbalance * 100).toFixed(1)}%</span>
        <span>卖方 {((1 - book.imbalance) * 100).toFixed(1)}%</span>
      </div>
    </section>
  );
}

export function DepthWidget({ widget, tick, onChange }: UtilityWidgetProps) {
  const { book, price } = useUtilityBook(widget, tick);
  let bidQuantity = 0;
  let askQuantity = 0;
  const bids = book.bids.slice(0, 10).map((level) => (bidQuantity += level.quantity));
  const asks = book.asks.slice(0, 10).map((level) => (askQuantity += level.quantity));
  const maximumQuantity = Math.max(bidQuantity, askQuantity);
  const bidPoints = bids.map((quantity, index) => (
    `${150 - (index + 1) * 14},${104 - quantity / maximumQuantity * 96}`
  )).join(' ');
  const askPoints = asks.map((quantity, index) => (
    `${150 + (index + 1) * 14},${104 - quantity / maximumQuantity * 96}`
  )).join(' ');
  return (
    <section className="utility-widget depth-section" aria-label={`${widget.symbol} 独立深度`}>
      <SymbolMarketControls widget={widget} onChange={onChange} />
      <div className="section-heading">
        <h2>累计深度</h2>
        <span className="numeric">中价 {formatPrice(price)}</span>
      </div>
      <div className="depth-chart">
        <svg viewBox="0 0 300 112" preserveAspectRatio="none" aria-label="模拟订单数量累计深度图" role="img">
          {[28, 56, 84].map((y) => <line className="chart-grid-line" key={y} x1="0" y1={y} x2="300" y2={y} />)}
          <polygon className="depth-chart__bid-area" points={`150,104 ${bidPoints} 10,104`} />
          <polygon className="depth-chart__ask-area" points={`150,104 ${askPoints} 290,104`} />
          <polyline className="depth-chart__bid-line" points={`150,104 ${bidPoints}`} />
          <polyline className="depth-chart__ask-line" points={`150,104 ${askPoints}`} />
          <line className="depth-chart__mid" x1="150" y1="8" x2="150" y2="104" />
        </svg>
      </div>
      <div className="depth-labels numeric"><span>买盘 {book.imbalance.toFixed(2)}</span><span>卖盘 {(1 - book.imbalance).toFixed(2)}</span></div>
      <div className="imbalance-track"><div className="imbalance-track__bid" style={{ width: `${book.imbalance * 100}%` }} /></div>
      <div className="imbalance-labels"><span>买方 {(book.imbalance * 100).toFixed(1)}%</span><span>卖方 {((1 - book.imbalance) * 100).toFixed(1)}%</span></div>
    </section>
  );
}
