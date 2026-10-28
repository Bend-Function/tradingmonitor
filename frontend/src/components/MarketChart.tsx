import { useEffect, useMemo, useRef } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
} from 'lightweight-charts';
import type {
  CandlestickData,
  HistogramData,
  IChartApi,
  ISeriesApi,
  LineData,
  UTCTimestamp,
} from 'lightweight-charts';
import { indicators } from '../market';
import type { Bar, Instrument } from '../market';
import type { IndicatorVisibility, Theme } from '../types';

type ChartSeries = {
  readonly candles: ISeriesApi<'Candlestick'>;
  readonly volume: ISeriesApi<'Histogram'>;
  readonly sma: ISeriesApi<'Line'>;
  readonly ema: ISeriesApi<'Line'>;
  readonly rsi: ISeriesApi<'Line'>;
  readonly cci: ISeriesApi<'Line'>;
};

type ChartPalette = {
  readonly background: string;
  readonly text: string;
  readonly grid: string;
  readonly border: string;
  readonly crosshair: string;
  readonly up: string;
  readonly down: string;
  readonly sma: string;
  readonly ema: string;
  readonly rsi: string;
  readonly cci: string;
  readonly fontFamily: string;
};

type Point = {
  readonly time: number;
  readonly value: number;
};

export type MarketChartProps = {
  readonly bars: readonly Bar[];
  readonly datasetKey: string;
  readonly instrument: Instrument;
  readonly visibility: IndicatorVisibility;
  readonly theme: Theme;
  readonly label: string;
  readonly resetPriceScale?: number;
};

function cssValue(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function readPalette(): ChartPalette {
  return {
    background: cssValue('--chart-bg'),
    text: cssValue('--chart-text'),
    grid: cssValue('--chart-grid'),
    border: cssValue('--chart-border'),
    crosshair: cssValue('--chart-crosshair'),
    up: cssValue('--chart-up'),
    down: cssValue('--chart-down'),
    sma: cssValue('--chart-sma'),
    ema: cssValue('--chart-ema'),
    rsi: cssValue('--chart-rsi'),
    cci: cssValue('--chart-cci') || cssValue('--chart-rsi'),
    fontFamily: cssValue('--font-mono'),
  };
}

function timestamp(seconds: number): UTCTimestamp {
  return seconds as UTCTimestamp;
}

function candle(bar: Bar): CandlestickData {
  return {
    time: timestamp(bar.time),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  };
}

function volume(bar: Bar, palette: ChartPalette): HistogramData {
  return {
    time: timestamp(bar.time),
    value: bar.volume,
    color: bar.close >= bar.open ? palette.up : palette.down,
  };
}

function line(point: Point): LineData {
  return { time: timestamp(point.time), value: point.value };
}

function resetPriceScales(series: ChartSeries): void {
  // SMA and EMA share the main price scale with the candles.
  series.candles.priceScale().applyOptions({ autoScale: true });
  series.rsi.priceScale().applyOptions({ autoScale: true });
  series.cci.priceScale().applyOptions({ autoScale: true });
}

export function MarketChart({
  bars,
  datasetKey,
  instrument,
  visibility,
  theme,
  label,
  resetPriceScale = 0,
}: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ChartSeries | null>(null);
  const candleKeyRef = useRef('');
  const firstCandleTimeRef = useRef<number | null>(null);
  const computed = useMemo(() => indicators(bars), [bars]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const palette = readPalette();
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: palette.background },
        textColor: palette.text,
        fontFamily: palette.fontFamily,
        panes: {
          separatorColor: palette.border,
          separatorHoverColor: palette.crosshair,
          enableResize: true,
        },
      },
      grid: {
        vertLines: { color: palette.grid },
        horzLines: { color: palette.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: palette.crosshair,
          labelBackgroundColor: palette.crosshair,
        },
        horzLine: {
          color: palette.crosshair,
          labelBackgroundColor: palette.crosshair,
        },
      },
      rightPriceScale: { borderColor: palette.border },
      timeScale: {
        borderColor: palette.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 3,
        barSpacing: 7,
        minBarSpacing: 1,
      },
      localization: { locale: 'zh-CN' },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        axisDoubleClickReset: true,
        mouseWheel: true,
        pinch: true,
      },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: palette.up,
      downColor: palette.down,
      wickUpColor: palette.up,
      wickDownColor: palette.down,
      borderVisible: false,
      priceLineVisible: true,
      lastValueVisible: true,
      priceFormat: {
        type: 'price',
        precision: instrument.precision,
        minMove: 1 / (10 ** instrument.precision),
      },
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    const sma = chart.addSeries(LineSeries, {
      color: palette.sma,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const ema = chart.addSeries(LineSeries, {
      color: palette.ema,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const rsi = chart.addSeries(LineSeries, {
      color: palette.rsi,
      lineWidth: 2,
      priceScaleId: 'rsi',
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      visible: false,
    });
    const cci = chart.addSeries(LineSeries, {
      color: palette.cci,
      lineWidth: 2,
      priceScaleId: 'cci',
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      visible: false,
    });
    chartRef.current = chart;
    seriesRef.current = { candles, volume: volumeSeries, sma, ema, rsi, cci };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      chart.resize(Math.floor(entry.contentRect.width), Math.floor(entry.contentRect.height));
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      candleKeyRef.current = '';
      firstCandleTimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (chart === null || series === null) return;
    const palette = readPalette();
    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: palette.background },
        textColor: palette.text,
        panes: { separatorColor: palette.border, separatorHoverColor: palette.crosshair },
      },
      grid: {
        vertLines: { color: palette.grid },
        horzLines: { color: palette.grid },
      },
      crosshair: {
        vertLine: { color: palette.crosshair, labelBackgroundColor: palette.crosshair },
        horzLine: { color: palette.crosshair, labelBackgroundColor: palette.crosshair },
      },
      rightPriceScale: { borderColor: palette.border },
      timeScale: { borderColor: palette.border },
    });
    series.candles.applyOptions({
      upColor: palette.up,
      downColor: palette.down,
      wickUpColor: palette.up,
      wickDownColor: palette.down,
    });
    series.sma.applyOptions({ color: palette.sma });
    series.ema.applyOptions({ color: palette.ema });
    series.rsi.applyOptions({ color: palette.rsi });
    series.cci.applyOptions({ color: palette.cci });
  }, [theme]);

  useEffect(() => {
    const series = seriesRef.current;
    if (series === null) return;
    series.candles.applyOptions({
      priceFormat: {
        type: 'price',
        precision: instrument.precision,
        minMove: 1 / (10 ** instrument.precision),
      },
    });
  }, [instrument.precision]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (chart === null || series === null) return;
    const first = bars[0];
    const last = bars.at(-1);
    const datasetChanged = candleKeyRef.current !== datasetKey;
    if (first === undefined || last === undefined) {
      series.candles.setData([]);
      if (datasetChanged) resetPriceScales(series);
      candleKeyRef.current = datasetKey;
      firstCandleTimeRef.current = null;
      return;
    }
    const keyChanged = datasetChanged || firstCandleTimeRef.current === null;
    const windowMoved = firstCandleTimeRef.current !== null && firstCandleTimeRef.current !== first.time;
    if (keyChanged || windowMoved) {
      series.candles.setData(bars.map(candle));
      if (keyChanged) {
        resetPriceScales(series);
        chart.timeScale().fitContent();
      }
    } else {
      series.candles.update(candle(last));
    }
    candleKeyRef.current = datasetKey;
    firstCandleTimeRef.current = first.time;
  }, [bars, datasetKey]);

  useEffect(() => {
    const series = seriesRef.current;
    if (series === null) return;
    const palette = readPalette();
    series.volume.setData(visibility.volume ? bars.map((bar) => volume(bar, palette)) : []);
  }, [bars, visibility.volume, theme]);

  useEffect(() => {
    const series = seriesRef.current;
    if (series === null) return;
    series.sma.setData(visibility.sma ? computed.sma.map(line) : []);
    series.ema.setData(visibility.ema ? computed.ema.map(line) : []);
    series.rsi.setData(visibility.rsi ? computed.rsi.map(line) : []);
    series.cci.setData(visibility.cci ? computed.cci.map(line) : []);
  }, [computed, visibility.sma, visibility.ema, visibility.rsi, visibility.cci]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (chart === null || series === null) return;
    const oscillators = [
      { series: series.rsi, visible: visibility.rsi },
      { series: series.cci, visible: visibility.cci },
    ];
    let paneIndex = 1;
    for (const oscillator of oscillators) {
      if (!oscillator.visible) continue;
      oscillator.series.moveToPane(paneIndex);
      oscillator.series.applyOptions({ visible: true });
      oscillator.series.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0.15 } });
      paneIndex += 1;
    }
    for (const oscillator of oscillators) {
      if (oscillator.visible) continue;
      oscillator.series.applyOptions({ visible: false });
      oscillator.series.moveToPane(0);
    }
    series.candles.getPane().setStretchFactor(4);
    for (const oscillator of oscillators) {
      if (oscillator.visible) oscillator.series.getPane().setStretchFactor(1);
    }
  }, [visibility.rsi, visibility.cci]);

  useEffect(() => {
    const series = seriesRef.current;
    if (series === null) return;
    series.candles.priceScale().applyOptions({ autoScale: true });
  }, [resetPriceScale]);

  return <div ref={containerRef} className="market-chart" role="img" aria-label={label} />;
}
