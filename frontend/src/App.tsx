import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Activity,
  HelpCircle,
  Lock,
  Moon,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  Sun,
  Unlock,
} from 'lucide-react';
import { HelpDialog, SearchDialog, SettingsDialog } from './components/Dialogs';
import { Workspace } from './components/Workspace';
import { INSTRUMENTS } from './market';
import type { Interval, Market } from './market';
import {
  clearSettings,
  createDefaultSettings,
  createPanel,
  createUtilityWidget,
  layoutForCount,
  readBlueprints,
  readSettings,
  saveBlueprint,
  saveSettings,
} from './settings';
import type {
  DashboardSettings,
  DialogName,
  IndicatorKey,
  PanelConfig,
  WidgetPosition,
} from './types';
import { useMarketData } from './useMarketData';
import {
  applyWidgetLayout,
  ensureResearchHeight,
  nextWidgetPosition,
  PURE_CHART_ROWS,
  resolveWidgetOverlaps,
} from './workspace';

const INDICATOR_OPTIONS = [
  { key: 'sma', label: 'SMA 20' },
  { key: 'ema', label: 'EMA 50' },
  { key: 'rsi', label: 'RSI 14' },
  { key: 'cci', label: 'CCI 20' },
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
  const [blueprints, setBlueprints] = useState(readBlueprints);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState('布局与命名蓝图仅保存在当前浏览器，不会上传。');

  const datasets = useMarketData(settings.panels, settings.market, tick);
  const selectedPanel = settings.panels.find((panel) => panel.id === settings.selectedId)
    ?? settings.panels[0];
  const dirty = useMemo(() => JSON.stringify(settings) !== savedSnapshot, [settings, savedSnapshot]);
  const visibleCount = settings.widgets.filter((widget) => widget.visible).length;

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

  const toggleIndicator = useCallback((key: IndicatorKey) => {
    setSettings((current) => {
      const panel = current.panels.find((candidate) => candidate.id === current.selectedId)
        ?? current.panels[0];
      const indicators = { ...panel.indicators, [key]: !panel.indicators[key] };
      const expandForResearch = (key === 'rsi' || key === 'cci') && indicators[key];
      return {
        ...current,
        panels: current.panels.map((candidate) => (
          candidate.id === panel.id ? { ...candidate, indicators } : candidate
        )),
        widgets: expandForResearch ? ensureResearchHeight(current.widgets, panel.id) : current.widgets,
      };
    });
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
      const position = { ...nextWidgetPosition(current.widgets, panel.id), w: 6, h: PURE_CHART_ROWS };
      return {
        ...current,
        panels: [...current.panels, panel],
        widgets: [...current.widgets, { id: panel.id, kind: 'chart', visible: true, position }],
        layout: layoutForCount(current.panels.length + 1),
        selectedId: panel.id,
      };
    });
  }, []);

  const addOrderBook = useCallback(() => {
    setSettings((current) => {
      const count = current.widgets.filter((widget) => widget.kind === 'orderbook').length;
      const symbol = INSTRUMENTS[count % INSTRUMENTS.length].symbol;
      const widget = createUtilityWidget('orderbook', symbol, current.market, current.widgets);
      return { ...current, widgets: [...current.widgets, widget] };
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
        widgets: current.widgets.filter((widget) => widget.id !== id),
        layout: layoutForCount(panels.length),
        selectedId: current.selectedId === id ? replacement.id : current.selectedId,
      };
    });
  }, []);

  const changeMarket = useCallback((market: Market) => {
    setSettings((current) => ({ ...current, market }));
  }, []);

  const handleLayoutChange = useCallback((layout: readonly WidgetPosition[]) => {
    setSettings((current) => {
      const widgets = applyWidgetLayout(current.widgets, layout);
      return widgets === current.widgets ? current : { ...current, widgets };
    });
  }, []);

  const hideWidget = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : current));
    setSettings((current) => ({
      ...current,
      widgets: current.widgets.map((widget) => (widget.id === id ? { ...widget, visible: false } : widget)),
    }));
  }, []);

  const restoreWidget = useCallback((id: string) => {
    setSettings((current) => {
      const widgets = current.widgets.map((widget) => (
        widget.id === id ? { ...widget, visible: true } : widget
      ));
      return { ...current, widgets: resolveWidgetOverlaps(widgets, id) };
    });
  }, []);

  const updateUtility = useCallback((
    id: string,
    update: { readonly symbol?: string; readonly market?: Market },
  ) => {
    setSettings((current) => {
      const widget = current.widgets.find((candidate) => candidate.id === id);
      const symbol = update.symbol;
      return {
        ...current,
        panels: widget?.kind === 'watchlist' && symbol !== undefined
          ? current.panels.map((panel) => (
            panel.id === current.selectedId ? { ...panel, symbol } : panel
          ))
          : current.panels,
        widgets: current.widgets.map((candidate) => (
          candidate.id === id && candidate.kind !== 'chart' ? { ...candidate, ...update } : candidate
        )),
      };
    });
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

  const handleSaveBlueprint = useCallback((name: string) => {
    if (!saveBlueprint(name, settings)) {
      setNotice('蓝图保存失败：请输入 1–40 个字符的名称，并检查浏览器存储。');
      return;
    }
    setBlueprints(readBlueprints());
    setNotice(`蓝图“${name.trim()}”已保存，包含全部组件、位置、尺寸、显隐与指标。`);
  }, [settings]);

  const handleApplyBlueprint = useCallback((name: string) => {
    const blueprint = blueprints.find((candidate) => candidate.name === name);
    if (blueprint === undefined) {
      setNotice('找不到该蓝图，请重新打开设置。');
      return;
    }
    const persisted = saveSettings(blueprint.settings);
    setSettings(blueprint.settings);
    setSavedSnapshot(persisted ? JSON.stringify(blueprint.settings) : savedSnapshot);
    setExpandedId(null);
    setDialog(null);
    setNotice(persisted
      ? `已应用蓝图“${name}”，刷新后仍会保持此工作区。`
      : `已应用蓝图“${name}”，但浏览器未能保存当前工作区。`);
  }, [blueprints, savedSnapshot]);

  const handleReset = useCallback(() => {
    const defaults = createDefaultSettings();
    const cleared = clearSettings();
    setSettings(defaults);
    setSavedSnapshot('');
    setExpandedId(null);
    setNotice(cleared
      ? '已恢复混合预设并清除当前保存；命名蓝图仍保留。'
      : '已恢复混合预设，但浏览器未能清除当前保存。');
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (dialog !== null) setDialog(null);
        else if (expandedId !== null) setExpandedId(null);
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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog, expandedId]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true"><Activity /></span>
          <div className="brand__name"><strong>弈线</strong><span>个人交易终端</span></div>
          <span className="badge">DEMO</span>
        </div>
        <div className="app-header__actions">
          <span className={`badge${paused ? '' : ' badge--live'}`}><span className="status-dot" />{paused ? '模拟已暂停' : '模拟行情'}</span>
          <button type="button" className="button header-search" onClick={() => setDialog('search')}><Search /><span>搜索标的</span><kbd>⌘K</kbd></button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setSettings((current) => ({ ...current, theme: current.theme === 'dark' ? 'light' : 'dark' }))}
            aria-label={settings.theme === 'dark' ? '切换浅色主题' : '切换深色主题'}
            title={settings.theme === 'dark' ? '浅色主题' : '深色主题'}
          >
            {settings.theme === 'dark' ? <Sun /> : <Moon />}
          </button>
          <button type="button" className="icon-button" onClick={() => setDialog('settings')} aria-label="打开工作区设置" title="工作区设置"><Settings /></button>
          <button type="button" className="icon-button" onClick={() => setDialog('help')} aria-label="打开操作指南" title="操作指南"><HelpCircle /></button>
        </div>
      </header>

      <section className="toolbar" aria-label="工作区工具栏">
        <div className="toolbar__group">
          <span className="toolbar__label">图表市场</span>
          <div className="segmented" aria-label="切换图表市场">
            <button type="button" aria-pressed={settings.market === 'spot'} onClick={() => changeMarket('spot')}>现货</button>
            <button type="button" aria-pressed={settings.market === 'usdm'} onClick={() => changeMarket('usdm')}>U 本位</button>
          </div>
        </div>
        <div className="toolbar__group">
          <span className="toolbar__label">组件</span>
          <button
            type="button"
            className={`button${settings.layoutLocked ? '' : ' is-active'}`}
            aria-pressed={!settings.layoutLocked}
            onClick={() => setSettings((current) => ({ ...current, layoutLocked: !current.layoutLocked }))}
            title={settings.layoutLocked ? '解锁后可拖动和调整尺寸' : '锁定当前桌面布局'}
          >
            {settings.layoutLocked ? <Lock /> : <Unlock />}
            {settings.layoutLocked ? '编辑布局' : '锁定布局'}
          </button>
          <button type="button" className="button" onClick={addPanel} disabled={settings.panels.length >= 6} title={settings.panels.length >= 6 ? '最多六个图表' : '添加图表'}><Plus />图表</button>
          <button type="button" className="button" onClick={addOrderBook}><Plus />盘口</button>
        </div>
        <div className="toolbar__group indicator-controls">
          <span className="toolbar__label">当前图表 · <strong className="numeric">{selectedPanel.symbol}</strong></span>
          {INDICATOR_OPTIONS.map(({ key, label }) => (
            <button type="button" className={`button${selectedPanel.indicators[key] ? ' is-active' : ''}`} key={key} aria-pressed={selectedPanel.indicators[key]} onClick={() => toggleIndicator(key)}>{label}</button>
          ))}
        </div>
        <div className="toolbar__group toolbar__group--end">
          <button type="button" className="button" onClick={() => setPaused((current) => !current)}>{paused ? <Play /> : <Pause />}{paused ? '继续' : '暂停'}</button>
        </div>
      </section>

      <main className="workspace">
        <Workspace
          settings={settings}
          datasets={datasets}
          tick={tick}
          expandedId={expandedId}
          onSelectPanel={selectPanel}
          onSymbolRequest={(id) => { selectPanel(id); setDialog('search'); }}
          onIntervalChange={(id, interval: Interval) => updatePanel(id, (panel) => ({ ...panel, interval }))}
          onToggleExpand={(id) => { selectPanel(id); setExpandedId((current) => (current === id ? null : id)); }}
          onRemovePanel={removePanel}
          onLayoutChange={handleLayoutChange}
          onHideWidget={hideWidget}
          onRestoreWidget={restoreWidget}
          onUtilityChange={updateUtility}
        />
      </main>

      <footer className="status-bar">
        <span><span className={`status-dot ${paused ? 'negative' : 'positive'}`} /> {paused ? '已暂停' : '模拟运行中'} · 1 秒 tick</span>
        <span>{settings.panels.length} / 6 图表 · {visibleCount} 个可见组件 · {settings.layoutLocked ? '布局已锁定' : '布局编辑中'}</span>
        <span>本地模拟数据 · 无真实交易</span>
      </footer>

      {dialog === 'search' && (
        <SearchDialog currentSymbol={selectedPanel.symbol} onSelect={(symbol) => { selectInstrument(symbol); setDialog(null); }} onClose={() => setDialog(null)} />
      )}
      {dialog === 'settings' && (
        <SettingsDialog
          settings={settings}
          blueprints={blueprints}
          dirty={dirty}
          notice={notice}
          onSave={handleSave}
          onLoad={handleLoad}
          onReset={handleReset}
          onSaveBlueprint={handleSaveBlueprint}
          onApplyBlueprint={handleApplyBlueprint}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
