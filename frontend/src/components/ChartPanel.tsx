import { useState } from 'react';
import { Maximize2, Minimize2, RotateCcw, Trash2 } from 'lucide-react';
import { formatPrice, getInstrument, INTERVALS } from '../market';
import type { Bar, Interval, Market } from '../market';
import type { PanelConfig, Theme } from '../types';
import { MarketChart } from './MarketChart';

export type ChartPanelProps = {
  readonly panel: PanelConfig;
  readonly bars: readonly Bar[];
  readonly market: Market;
  readonly theme: Theme;
  readonly selected: boolean;
  readonly expanded: boolean;
  readonly canRemove: boolean;
  readonly onSelect: () => void;
  readonly onSymbolRequest: () => void;
  readonly onIntervalChange: (interval: Interval) => void;
  readonly onToggleExpand: () => void;
  readonly onRemove: () => void;
};

function signedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function ChartPanel({
  panel,
  bars,
  market,
  theme,
  selected,
  expanded,
  canRemove,
  onSelect,
  onSymbolRequest,
  onIntervalChange,
  onToggleExpand,
  onRemove,
}: ChartPanelProps) {
  const [priceScaleReset, setPriceScaleReset] = useState(0);
  const instrument = getInstrument(panel.symbol);
  const first = bars[0];
  const last = bars.at(-1);
  const change = first === undefined || last === undefined || first.open === 0
    ? 0
    : ((last.close - first.open) / first.open) * 100;
  const changeClass = change >= 0 ? 'positive' : 'negative';
  const datasetKey = `${panel.symbol}:${market}:${panel.interval}`;

  return (
    <section
      className={`chart-panel panel${selected ? ' is-selected' : ''}${expanded ? ' is-expanded' : ''}`}
      aria-label={`${instrument.name} 图表面板${selected ? '，当前选中' : ''}`}
      onPointerDown={onSelect}
    >
      <header className="chart-panel__header">
        <button
          type="button"
          className="instrument-button"
          onClick={() => {
            onSelect();
            onSymbolRequest();
          }}
          aria-label={`更换 ${instrument.symbol} 标的`}
          title="搜索并更换标的"
        >
          <span className="instrument-button__symbol numeric">{instrument.symbol}</span>
          <span className="instrument-button__market">{market === 'spot' ? '现货' : 'U 本位'}</span>
        </button>
        <span className={`chart-panel__change numeric ${changeClass}`}>{signedPercent(change)}</span>
        <div className="chart-panel__actions">
          <select
            className="interval-select numeric"
            value={panel.interval}
            onChange={(event) => onIntervalChange(event.target.value as Interval)}
            aria-label={`${instrument.symbol} K线周期`}
          >
            {INTERVALS.map((interval) => <option key={interval} value={interval}>{interval}</option>)}
          </select>
          <button
            type="button"
            className="icon-button"
            onClick={() => setPriceScaleReset((current) => current + 1)}
            aria-label="重置价格比例尺"
            title="重置价格比例尺"
          >
            <RotateCcw />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onToggleExpand}
            aria-label={expanded ? '退出单图放大' : `放大 ${instrument.symbol} 图表`}
            title={expanded ? '退出放大（Esc）' : '单图放大'}
            autoFocus={expanded}
          >
            {expanded ? <Minimize2 /> : <Maximize2 />}
          </button>
          <button
            type="button"
            className="icon-button panel-remove"
            onClick={onRemove}
            disabled={!canRemove}
            aria-label={`移除 ${instrument.symbol} 面板`}
            title={canRemove ? '移除面板' : '至少保留一个面板'}
          >
            <Trash2 />
          </button>
        </div>
      </header>
      <div className="chart-panel__summary numeric" aria-label="最新模拟K线数值">
        <span>开 <strong>{formatPrice(last?.open ?? instrument.base)}</strong></span>
        <span>高 <strong className="positive">{formatPrice(last?.high ?? instrument.base)}</strong></span>
        <span>低 <strong className="negative">{formatPrice(last?.low ?? instrument.base)}</strong></span>
        <span>收 <strong>{formatPrice(last?.close ?? instrument.base)}</strong></span>
      </div>
      <div className="chart-panel__legend" aria-label="已启用指标">
        {panel.indicators.sma && <span><i className="legend-line legend-line--sma" />SMA 20</span>}
        {panel.indicators.ema && <span><i className="legend-line legend-line--ema" />EMA 50</span>}
        {panel.indicators.rsi && <span><i className="legend-line legend-line--rsi" />RSI 14</span>}
        {panel.indicators.cci && (
          <span>
            <i className="legend-line" style={{ background: 'var(--chart-cci, var(--chart-rsi))' }} />
            CCI 20
          </span>
        )}
        {panel.indicators.volume && <span className="muted">VOL</span>}
      </div>
      <MarketChart
        bars={bars}
        datasetKey={datasetKey}
        instrument={instrument}
        visibility={panel.indicators}
        theme={theme}
        label={`${instrument.name} ${panel.interval} 模拟K线图，可拖动和平移缩放`}
        resetPriceScale={priceScaleReset}
      />
    </section>
  );
}
