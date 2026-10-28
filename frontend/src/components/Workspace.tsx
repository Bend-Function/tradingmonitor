import { createPortal } from 'react-dom';
import { useState } from 'react';
import type { ReactNode } from 'react';
import ReactGridLayout, { noCompactor, useContainerWidth } from 'react-grid-layout';
import { Eye, EyeOff, GripVertical } from 'lucide-react';
import { ChartPanel } from './ChartPanel';
import { DepthWidget, OrderBookWidget, WatchlistWidget } from './Inspector';
import type { PanelDataset } from '../useMarketData';
import type { Interval, Market } from '../market';
import type {
  DashboardSettings,
  PanelConfig,
  WidgetPosition,
  WorkspaceWidget,
} from '../types';
import { GRID_COLUMNS } from '../workspace';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ROW_HEIGHT = 44;
const MOBILE_WIDTH = 760;

function widgetTitle(widget: WorkspaceWidget, panels: readonly PanelConfig[]): string {
  if (widget.kind === 'watchlist') return '自选列表';
  if (widget.kind === 'orderbook') return `盘口 · ${widget.symbol}`;
  if (widget.kind === 'depth') return `深度 · ${widget.symbol}`;
  return panels.find((panel) => panel.id === widget.id)?.symbol ?? '图表';
}

type WidgetFrameProps = {
  readonly widget: WorkspaceWidget;
  readonly title: string;
  readonly editing: boolean;
  readonly onHide: () => void;
  readonly children: ReactNode;
};

function WidgetFrame({ widget, title, editing, onHide, children }: WidgetFrameProps) {
  return (
    <section className={`workspace-widget workspace-widget--${widget.kind}`} aria-label={title}>
      <header className="workspace-widget__bar">
        <span
          className="widget-drag-handle"
          title={editing ? '拖动组件到新的网格位置' : '布局已锁定'}
          aria-hidden="true"
        >
          <GripVertical />
          <strong>{title}</strong>
        </span>
        <div className="workspace-widget__actions">
          {editing && <span className="widget-dimensions numeric">{widget.position.w} × {widget.position.h}</span>}
          <button type="button" className="icon-button" onClick={onHide} aria-label={`隐藏${title}`} title="隐藏，可从恢复栏找回">
            <EyeOff />
          </button>
        </div>
      </header>
      <div className="workspace-widget__body">{children}</div>
    </section>
  );
}

export type WorkspaceProps = {
  readonly settings: DashboardSettings;
  readonly datasets: Readonly<Record<string, PanelDataset>>;
  readonly tick: number;
  readonly expandedId: string | null;
  readonly onSelectPanel: (id: string) => void;
  readonly onSymbolRequest: (id: string) => void;
  readonly onIntervalChange: (id: string, interval: Interval) => void;
  readonly onToggleExpand: (id: string) => void;
  readonly onRemovePanel: (id: string) => void;
  readonly onLayoutChange: (layout: readonly WidgetPosition[]) => void;
  readonly onHideWidget: (id: string) => void;
  readonly onRestoreWidget: (id: string) => void;
  readonly onUtilityChange: (id: string, update: { readonly symbol?: string; readonly market?: Market }) => void;
};

export function Workspace({
  settings,
  datasets,
  tick,
  expandedId,
  onSelectPanel,
  onSymbolRequest,
  onIntervalChange,
  onToggleExpand,
  onRemovePanel,
  onLayoutChange,
  onHideWidget,
  onRestoreWidget,
  onUtilityChange,
}: WorkspaceProps) {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
  const [interactionHeight, setInteractionHeight] = useState<number>();
  const editing = !settings.layoutLocked;
  const visibleWidgets = settings.widgets.filter((widget) => widget.visible);
  const hiddenWidgets = settings.widgets.filter((widget) => !widget.visible);
  const expandedPanel = settings.panels.find((panel) => panel.id === expandedId);

  const renderChart = (panel: PanelConfig, expanded: boolean) => (
    <ChartPanel
      panel={panel}
      bars={datasets[panel.id]?.bars ?? []}
      market={settings.market}
      theme={settings.theme}
      selected={panel.id === settings.selectedId}
      expanded={expanded}
      canRemove={settings.panels.length > 1}
      onSelect={() => onSelectPanel(panel.id)}
      onSymbolRequest={() => onSymbolRequest(panel.id)}
      onIntervalChange={(interval) => onIntervalChange(panel.id, interval)}
      onToggleExpand={() => onToggleExpand(panel.id)}
      onRemove={() => onRemovePanel(panel.id)}
    />
  );

  const renderContent = (widget: WorkspaceWidget) => {
    if (widget.kind === 'chart') {
      const panel = settings.panels.find((candidate) => candidate.id === widget.id);
      if (panel === undefined) return null;
      if (widget.id === expandedId) {
        return <div className="widget-expanded-placeholder">图表正在全屏显示，按 Esc 返回工作区。</div>;
      }
      return renderChart(panel, false);
    }
    const props = {
      widget,
      tick,
      onChange: (update: { readonly symbol?: string; readonly market?: Market }) => onUtilityChange(widget.id, update),
    };
    if (widget.kind === 'watchlist') return <WatchlistWidget {...props} />;
    if (widget.kind === 'orderbook') return <OrderBookWidget {...props} />;
    return <DepthWidget {...props} />;
  };

  const renderWidget = (widget: WorkspaceWidget, mobile = false) => (
    <WidgetFrame
      key={widget.id}
      widget={widget}
      title={widgetTitle(widget, settings.panels)}
      editing={editing && !mobile}
      onHide={() => onHideWidget(widget.id)}
    >
      {renderContent(widget)}
    </WidgetFrame>
  );

  return (
    <section className="workspace-board" aria-label="自定义工作区">
      {hiddenWidgets.length > 0 && (
        <div className="widget-restore-bar">
          <span><Eye /> 已隐藏 {hiddenWidgets.length} 个组件</span>
          <div>
            {hiddenWidgets.map((widget) => (
              <button type="button" className="button" key={widget.id} onClick={() => onRestoreWidget(widget.id)}>
                恢复 {widgetTitle(widget, settings.panels)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="workspace-mobile-note">
        窄屏按单列预览，保留宽屏蓝图；标的、指标与显隐仍可调整。
      </div>
      <div className="workspace-grid-host" ref={containerRef} style={{ minHeight: interactionHeight }}>
        {mounted && width >= MOBILE_WIDTH && visibleWidgets.length > 0 && (
          <ReactGridLayout
            className={`workspace-grid${editing ? ' is-editing' : ''}`}
            width={width}
            autoSize
            compactor={noCompactor}
            gridConfig={{ cols: GRID_COLUMNS, rowHeight: ROW_HEIGHT, margin: [8, 8], containerPadding: [0, 0] }}
            dragConfig={{ enabled: editing, handle: '.widget-drag-handle', cancel: 'button,input,select', allowMobileScroll: true }}
            resizeConfig={{ enabled: editing, handles: ['se'] }}
            layout={visibleWidgets.map((widget) => widget.position)}
            onDragStart={() => setInteractionHeight(containerRef.current?.getBoundingClientRect().height)}
            onDragStop={() => setInteractionHeight(undefined)}
            onResizeStart={() => setInteractionHeight(containerRef.current?.getBoundingClientRect().height)}
            onResizeStop={() => setInteractionHeight(undefined)}
            onLayoutChange={(layout) => onLayoutChange(layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })))}
          >
            {visibleWidgets.map((widget) => (
              <div className="workspace-grid-item" key={widget.id}>{renderWidget(widget)}</div>
            ))}
          </ReactGridLayout>
        )}
        {mounted && width < MOBILE_WIDTH && (
          <div className="workspace-mobile-stack">
            {[...visibleWidgets]
              .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
              .map((widget) => renderWidget(widget, true))}
          </div>
        )}
        {mounted && visibleWidgets.length === 0 && (
          <div className="empty-state">所有组件均已隐藏。使用上方恢复按钮找回，数据与蓝图仍然保留。</div>
        )}
      </div>
      {expandedPanel !== undefined && createPortal(renderChart(expandedPanel, true), document.body)}
    </section>
  );
}
