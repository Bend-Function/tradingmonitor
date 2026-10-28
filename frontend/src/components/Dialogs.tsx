import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, FolderOpen, RotateCcw, Save, Search, X } from 'lucide-react';
import { INSTRUMENTS } from '../market';
import type { DashboardSettings, WorkspaceBlueprint } from '../types';

type DialogShellProps = {
  readonly title: string;
  readonly eyebrow: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly onClose: () => void;
};

function DialogShell({ title, eyebrow, children, className = '', onClose }: DialogShellProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`dialog ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog__frame">
        <header className="dialog__header">
          <div>
            <span className="section-eyebrow">{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={`关闭${title}`} title="关闭（Esc）">
            <X />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function SearchDialog({
  currentSymbol,
  onSelect,
  onClose,
}: {
  readonly currentSymbol: string;
  readonly onSelect: (symbol: string) => void;
  readonly onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (normalized.length === 0) return INSTRUMENTS;
    return INSTRUMENTS.filter((instrument) => (
      `${instrument.symbol} ${instrument.name}`.toLocaleLowerCase().includes(normalized)
    ));
  }, [query]);

  return (
    <DialogShell title="搜索标的" eyebrow="INSTRUMENT SEARCH" className="dialog--search" onClose={onClose}>
      <div className="search-field">
        <Search aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="输入 BTC、Ethereum…"
          aria-label="搜索代码或名称"
          autoFocus
        />
        <kbd>⌘K</kbd>
      </div>
      <div className="search-results" aria-live="polite">
        {filtered.length === 0 ? (
          <p className="empty-state">没有匹配的模拟标的。试试 BTC、SOL 或 DOGE。</p>
        ) : filtered.map((instrument) => (
          <button
            type="button"
            className={`search-result${instrument.symbol === currentSymbol ? ' is-active' : ''}`}
            key={instrument.symbol}
            onClick={() => onSelect(instrument.symbol)}
          >
            <span className="search-result__icon numeric">{instrument.symbol.slice(0, 1)}</span>
            <span><strong className="numeric">{instrument.symbol}</strong><small>{instrument.name} · USDT</small></span>
            {instrument.symbol === currentSymbol && <Check aria-label="当前标的" />}
          </button>
        ))}
      </div>
      <p className="dialog__footnote">选择后替换当前图表面板，不影响其他面板。行情为浏览器模拟。</p>
    </DialogShell>
  );
}

export function SettingsDialog({
  settings,
  blueprints,
  dirty,
  notice,
  onSave,
  onLoad,
  onReset,
  onSaveBlueprint,
  onApplyBlueprint,
  onClose,
}: {
  readonly settings: DashboardSettings;
  readonly blueprints: readonly WorkspaceBlueprint[];
  readonly dirty: boolean;
  readonly notice: string;
  readonly onSave: () => void;
  readonly onLoad: () => void;
  readonly onReset: () => void;
  readonly onSaveBlueprint: (name: string) => void;
  readonly onApplyBlueprint: (name: string) => void;
  readonly onClose: () => void;
}) {
  const [blueprintName, setBlueprintName] = useState('');
  const blueprintNameId = useId();
  const trimmedName = blueprintName.trim();

  return (
    <DialogShell title="工作区设置" eyebrow="LOCAL WORKSPACE" onClose={onClose}>
      <div className="settings-summary">
        <div><span>自定义工作区</span><strong className="numeric">{settings.widgets.length} 组件 / {settings.panels.length} 图表</strong></div>
        <div><span>图表市场</span><strong>{settings.market === 'spot' ? '现货' : 'USDⓈ-M 永续'}</strong></div>
        <div><span>外观</span><strong>{settings.theme === 'dark' ? '深色' : '浅色'}</strong></div>
        <div><span>保存位置</span><strong>当前浏览器 localStorage</strong></div>
      </div>
      <div className="settings-status">
        <span className={`status-dot ${dirty ? 'negative' : 'positive'}`} />
        <span>{dirty ? '有尚未保存的更改' : '工作区与已保存版本一致'}</span>
      </div>
      <div className="settings-actions">
        <button type="button" className="button button--primary" onClick={onSave}><Save />保存工作区</button>
        <button type="button" className="button" onClick={onLoad}><FolderOpen />读取保存</button>
        <button type="button" className="button button--danger" onClick={onReset}><RotateCcw />恢复默认</button>
      </div>
      <section className="blueprint-section">
        <h3>命名蓝图</h3>
        <p className="blueprint-description" id={`${blueprintNameId}-description`}>
          将当前全部组件、桌面位置、尺寸、显隐和指标保存为可重复应用的版本。
        </p>
        <form
          className="blueprint-save"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmedName.length > 0) onSaveBlueprint(trimmedName);
          }}
        >
          <label htmlFor={blueprintNameId}>蓝图名称</label>
          <div className="blueprint-save__row">
            <input
              id={blueprintNameId}
              value={blueprintName}
              onChange={(event) => setBlueprintName(event.target.value)}
              aria-describedby={`${blueprintNameId}-description`}
              autoComplete="off"
              maxLength={40}
              required
            />
            <button type="submit" className="button button--primary" disabled={trimmedName.length === 0} aria-label="保存命名蓝图">
              <Save />保存蓝图
            </button>
          </div>
        </form>
        {blueprints.length === 0 ? (
          <p className="blueprint-empty">还没有命名蓝图。输入名称并保存后，可从这里一键应用。</p>
        ) : (
          <ul className="blueprint-list" aria-label="已保存的命名蓝图">
            {blueprints.map((blueprint) => (
              <li key={blueprint.name}>
                <span className="blueprint-list__meta">
                  <strong>{blueprint.name}</strong>
                  <span className="numeric">{blueprint.settings.widgets.length} 组件 · {blueprint.settings.panels.length} 图表</span>
                </span>
                <button
                  type="button"
                  className="button"
                  onClick={() => onApplyBlueprint(blueprint.name)}
                  aria-label={`应用蓝图 ${blueprint.name}`}
                >
                  应用
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="dialog__footnote" aria-live="polite">{notice}</p>
      <div className="settings-note">
        <strong>仅本机持久化</strong>
        <p>当前工作区与命名蓝图分别保存，刷新后可读取。窄屏单列预览不会改写桌面位置；清除浏览器站点数据会同时删除两者。</p>
      </div>
    </DialogShell>
  );
}

export function HelpDialog({ onClose }: { readonly onClose: () => void }) {
  return (
    <DialogShell title="操作指南" eyebrow="DEMO PLAYBOOK" onClose={onClose}>
      <div className="help-content">
        <section>
          <h3>自定义工作区</h3>
          <ul>
            <li><strong>拖动与调整尺寸</strong><span>桌面点击“编辑布局”解锁后，按住组件顶部抓手拖动，使用右下角手柄调整尺寸；点击“锁定布局”结束编辑。</span></li>
            <li><strong>图表与研究高度</strong><span>纯图表默认占 6 行；启用 RSI 14 或 CCI 20 后，该图表自动扩展为 12 行研究高度，并为其他组件重新排开位置。</span></li>
            <li><strong>隐藏与恢复</strong><span>组件顶部的隐藏按钮只改变显隐，不删除配置。工作区上方会出现恢复栏，可逐个找回隐藏组件。</span></li>
            <li><strong>独立市场组件</strong><span>盘口与累计深度各自选择标的和市场，不跟随当前图表；点击自选列表中的标的会切换当前图表。</span></li>
            <li><strong>命名蓝图</strong><span>在设置中输入名称即可保存全部组件、位置、尺寸、显隐与指标；从蓝图列表点击“应用”即可恢复该版本。</span></li>
          </ul>
        </section>
        <section>
          <h3>图表与移动操作</h3>
          <ul>
            <li><strong>独立周期与指标</strong><span>每个图表可选 1m–1d；工具栏为当前图表切换 SMA 20、EMA 50、RSI 14、CCI 20 和成交量。</span></li>
            <li><strong>图表交互</strong><span>滚轮或双指缩放，拖动平移；普通模拟 tick 不会重置可视范围。单图放大后按 Esc 返回。</span></li>
            <li><strong>窄屏单列预览</strong><span>窄屏按桌面顺序单列显示，不提供拖动或缩放手柄。仍可调整标的、指标与显隐，桌面位置和命名蓝图不会被覆盖。</span></li>
            <li><strong>本地工作区</strong><span>“保存工作区”和“读取保存”管理当前版本；“恢复默认”恢复混合预设并保留命名蓝图。</span></li>
          </ul>
        </section>
        <section>
          <h3>键盘快捷键</h3>
          <div className="shortcut-grid">
            <span><kbd>Ctrl / ⌘ K</kbd>搜索标的</span>
            <span><kbd>P</kbd>暂停 / 继续模拟</span>
            <span><kbd>Esc</kbd>关闭对话框或退出单图放大</span>
          </div>
        </section>
        <section className="help-future">
          <h3>未来集成 · 当前未接入</h3>
          <p>Binance / Nautilus 实时行情、账户同步和交易执行均为未来集成。本 Demo 没有登录、真实下单、后端连接或云端保存。</p>
        </section>
      </div>
    </DialogShell>
  );
}
