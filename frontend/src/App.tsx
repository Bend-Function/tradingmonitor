import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Activity,
  HelpCircle,
  Moon,
  PanelRightOpen,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  Sun,
} from 'lucide-react';
import { ChartPanel } from './components/ChartPanel';
import { HelpDialog, SearchDialog, SettingsDialog } from './components/Dialogs';
import { Inspector } from './components/Inspector';
import { getInstrument, INSTRUMENTS } from './market';
import type { Interval, Market } from './market';
import {
  clearSettings,
  createDefaultSettings,
  createPanel,
  layoutForCount,
  readSettings,
  saveSettings,
} from './settings';
import { LAYOUTS } from './types';
import type {
  DashboardSettings,
  DialogName,
  IndicatorKey,
  Layout,
  PanelConfig,
} from './types';
import { useMarketData, useWatchlistPrices } from './useMarketData';

const INDICATOR_OPTIONS = [
  { key: 'sma', label: 'SMA 20' },
  { key: 'ema', label: 'EMA 50' },
  { key: 'rsi', label: 'RSI 14' },
  { key: 'volume', label: '成交量' },
] as const satisfies readonly { key: IndicatorKey; label: string }[];

function initialWorkspace(): { settings: DashboardSettings; savedSnapshot: string } {
  const saved = readSettings();
  return {
    settings: saved ?? createDefaultSettings(),
    savedSnapshot: saved === null ? '' : JSON.stringify(saved),
  };
}

function nextSymbol(panels: readonly PanelConfig[]): string {
  const unused = INSTRUMENTS.find((instrument) => (
    panels.every((panel) => panel.symbol !== instrument.symbol)
  ));
  return (unused ?? INSTRUMENTS[panels.length % INSTRUMENTS.length]).symbol;
}

export default function App() {
  const [initial] = useState(initialWorkspace);
  const [settings, setSettings] = useState<DashboardSettings>(initial.settings);
  const [savedSnapshot, setSavedSnapshot] = useState(initial.savedSnapshot);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState('更改仅保存在当前浏览器，不会上传。');

  const datasets = useMarketData(settings.panels, settings.market, tick);
  const watchPrices = useWatchlistPrices(settings.market, tick);
  const selectedPanel = settings.panels.find((panel) => panel.id === settings.selectedId)
    ?? settings.panels[0];
  const selectedDataset = datasets[selectedPanel.id];
  const selectedInstrument = getInstrument(selectedPanel.symbol);
  const selectedPrice = selectedDataset?.bars.at(-1)?.close ?? selectedInstrument.base;
  const dirty = useMemo(() => JSON.stringify(settings) !== savedSnapshot, [settings, savedSnapshot]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setTick((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [paused]);

  const selectPanel = useCallback((id: string) => {
    setSettings((current) => (
      current.selectedId === id ? current : { ...current, selectedId: id }
    ));
  }, []);

  const updatePanel = useCallback((
    id: string,
    update: (panel: PanelConfig) => PanelConfig,
  ) => {
    setSettings((current) => ({
      ...current,
      panels: current.panels.map((panel) => (panel.id === id ? update(panel) : panel)),
    }));
  }, []);

  const selectInstrument = useCallback((symbol: string) => {
    setSettings((current) => ({
      ...current,
      panels: current.panels.map((panel) => (
        panel.id === current.selectedId ? { ...panel, symbol } : panel
      )),
    }));
  }, []);

  const addPanel = useCallback(() => {
    setSettings((current) => {
      if (current.panels.length >= 6) return current;
      const panel = createPanel(nextSymbol(current.panels));
      const panels = [...current.panels, panel];
      return {
        ...current,
        panels,
        layout: layoutForCount(panels.length),
        selectedId: panel.id,
      };
    });
  }, []);

  const removePanel = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : current));
    setSettings((current) => {
      if (current.panels.length <= 1) return current;
      const removedIndex = current.panels.findIndex((panel) => panel.id === id);
      const panels = current.panels.filter((panel) => panel.id !== id);
      const replacement = panels[Math.min(Math.max(removedIndex, 0), panels.length - 1)] ?? panels[0];
      return {
        ...current,
        panels,
        layout: layoutForCount(panels.length),
        selectedId: current.selectedId === id ? replacement.id : current.selectedId,
      };
    });
  }, []);

  const changeLayout = useCallback((layout: Layout) => {
    setExpandedId(null);
    setSettings((current) => {
      const panels = current.panels.slice(0, layout);
      while (panels.length < layout) {
        panels.push(createPanel(nextSymbol(panels)));
      }
      return {
        ...current,
        layout,
        panels,
        selectedId: panels.some((panel) => panel.id === current.selectedId)
          ? current.selectedId
          : panels[0].id,
      };
    });
  }, []);

  const changeMarket = useCallback((market: Market) => {
    setSettings((current) => ({ ...current, market }));
  }, []);

  const handleSave = useCallback(() => {
    if (!saveSettings(settings)) {
      setNotice('保存失败：浏览器存储不可用，请检查隐私或存储设置。');
      return;
    }
    setSavedSnapshot(JSON.stringify(settings));
    setNotice('工作区已保存到本机，刷新页面会自动恢复。');
  }, [settings]);

  const handleLoad = useCallback(() => {
    const saved = readSettings();
    if (saved === null) {
      setNotice('没有可读取的有效保存内容。请先保存工作区。');
      return;
    }
    setSettings(saved);
    setSavedSnapshot(JSON.stringify(saved));
    setExpandedId(null);
    setNotice('已读取本机保存的工作区。');
  }, []);

  const handleReset = useCallback(() => {
    const defaults = createDefaultSettings();
    const cleared = clearSettings();
    setSettings(defaults);
    setSavedSnapshot('');
    setExpandedId(null);
    setNotice(cleared
      ? '已恢复默认工作区，并清除本机保存；当前默认值尚未保存。'
      : '已恢复默认工作区，但浏览器未能清除本机保存。');
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (dialog !== null) setDialog(null);
        else if (expandedId !== null) setExpandedId(null);
        else if (inspectorOpen) setInspectorOpen(false);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setDialog('search');
        return;
      }
      const target = event.target;
      const editable = target instanceof HTMLElement && (
        target.isContentEditable
        || target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT'
      );
      if (editable || dialog !== null || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setPaused((current) => !current);
        return;
      }
      const layout = LAYOUTS.find((value) => String(value) === event.key);
      if (layout !== undefined) {
        event.preventDefault();
        changeLayout(layout);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeLayout, dialog, expandedId, inspectorOpen]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true"><Activity /></span>
          <div className="brand__name">
            <strong>弈线</strong>
            <span>个人交易终端</span>
          </div>
          <span className="badge">DEMO</span>
        </div>
        <div className="app-header__actions">
          <span className={`badge${paused ? '' : ' badge--live'}`}>
            <span className="status-dot" />
            {paused ? '模拟已暂停' : '模拟行情'}
          </span>
          <button type="button" className="button header-search" onClick={() => setDialog('search')}>
            <Search />
            <span>搜索标的</span>
            <kbd>⌘K</kbd>
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setSettings((current) => ({
              ...current,
              theme: current.theme === 'dark' ? 'light' : 'dark',
            }))}
            aria-label={settings.theme === 'dark' ? '切换浅色主题' : '切换深色主题'}
            title={settings.theme === 'dark' ? '浅色主题' : '深色主题'}
          >
            {settings.theme === 'dark' ? <Sun /> : <Moon />}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setDialog('settings')}
            aria-label="打开工作区设置"
            title="工作区设置"
          >
            <Settings />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setDialog('help')}
            aria-label="打开操作指南"
            title="操作指南"
          >
            <HelpCircle />
          </button>
        </div>
      </header>

      <section className="toolbar" aria-label="图表工具栏">
        <div className="toolbar__group">
          <span className="toolbar__label">市场</span>
          <div className="segmented" aria-label="切换市场">
            <button type="button" aria-pressed={settings.market === 'spot'} onClick={() => changeMarket('spot')}>现货</button>
            <button type="button" aria-pressed={settings.market === 'usdm'} onClick={() => changeMarket('usdm')}>U 本位</button>
          </div>
        </div>
        <div className="toolbar__group">
          <span className="toolbar__label">布局</span>
          <div className="segmented" aria-label="切换图表布局">
            {LAYOUTS.map((layout) => (
              <button
                type="button"
                className="numeric"
                key={layout}
                aria-pressed={settings.layout === layout}
                aria-label={`${layout} 格布局`}
                onClick={() => changeLayout(layout)}
              >
                {layout}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={addPanel}
            disabled={settings.panels.length >= 6}
            aria-label="添加图表面板"
            title={settings.panels.length >= 6 ? '最多六个面板' : '添加面板'}
          >
            <Plus />
          </button>
        </div>
        <div className="toolbar__group indicator-controls">
          <span className="toolbar__label">当前面板 · <strong className="numeric">{selectedPanel.symbol}</strong></span>
          {INDICATOR_OPTIONS.map(({ key, label }) => (
            <button
              type="button"
              className={`button${selectedPanel.indicators[key] ? ' is-active' : ''}`}
              key={key}
              aria-pressed={selectedPanel.indicators[key]}
              onClick={() => updatePanel(selectedPanel.id, (panel) => ({
                ...panel,
                indicators: { ...panel.indicators, [key]: !panel.indicators[key] },
              }))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="toolbar__group toolbar__group--end">
          <button type="button" className="button" onClick={() => setPaused((current) => !current)}>
            {paused ? <Play /> : <Pause />}
            {paused ? '继续' : '暂停'}
          </button>
          <button
            type="button"
            className="button inspector-toggle"
            onClick={() => setInspectorOpen(true)}
            aria-label="打开市场检查器"
          >
            <PanelRightOpen />
            盘口
          </button>
        </div>
      </section>

      <main className="workspace">
        <div className={`chart-grid layout-${settings.layout}${expandedId !== null ? ' has-expanded' : ''}`}>
          {settings.panels.map((panel) => (
            <ChartPanel
              key={panel.id}
              panel={panel}
              bars={datasets[panel.id]?.bars ?? []}
              market={settings.market}
              theme={settings.theme}
              selected={panel.id === selectedPanel.id}
              expanded={panel.id === expandedId}
              canRemove={settings.panels.length > 1}
              onSelect={() => selectPanel(panel.id)}
              onSymbolRequest={() => {
                selectPanel(panel.id);
                setDialog('search');
              }}
              onIntervalChange={(interval: Interval) => updatePanel(panel.id, (current) => ({
                ...current,
                interval,
              }))}
              onToggleExpand={() => {
                selectPanel(panel.id);
                setExpandedId((current) => (current === panel.id ? null : panel.id));
              }}
              onRemove={() => removePanel(panel.id)}
            />
          ))}
        </div>
        {inspectorOpen && (
          <button
            type="button"
            className="inspector-backdrop"
            aria-label="关闭市场检查器"
            onClick={() => setInspectorOpen(false)}
          />
        )}
        <div className={`inspector-drawer${inspectorOpen ? ' is-open' : ''}`}>
          <Inspector
            panel={selectedPanel}
            market={settings.market}
            price={selectedPrice}
            tick={tick}
            watchPrices={watchPrices}
            onClose={() => setInspectorOpen(false)}
            onSelectInstrument={selectInstrument}
          />
        </div>
      </main>

      <footer className="status-bar">
        <span><span className={`status-dot ${paused ? 'negative' : 'positive'}`} /> {paused ? '已暂停' : '模拟运行中'} · 1 秒 tick</span>
        <span>{settings.panels.length} / 6 面板 · {settings.market === 'spot' ? '现货' : 'USDⓈ-M 永续'} · {settings.theme === 'dark' ? '深色' : '浅色'}</span>
        <span>本地模拟数据 · 无真实交易</span>
      </footer>

      {dialog === 'search' && (
        <SearchDialog
          currentSymbol={selectedPanel.symbol}
          onSelect={(symbol) => {
            selectInstrument(symbol);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'settings' && (
        <SettingsDialog
          settings={settings}
          dirty={dirty}
          notice={notice}
          onSave={handleSave}
          onLoad={handleLoad}
          onReset={handleReset}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
