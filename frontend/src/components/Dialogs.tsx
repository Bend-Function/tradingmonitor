import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, FolderOpen, RotateCcw, Save, Search, X } from 'lucide-react';
import { INSTRUMENTS } from '../market';
import type { DashboardSettings } from '../types';

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
  dirty,
  notice,
  onSave,
  onLoad,
  onReset,
  onClose,
}: {
  readonly settings: DashboardSettings;
  readonly dirty: boolean;
  readonly notice: string;
  readonly onSave: () => void;
  readonly onLoad: () => void;
  readonly onReset: () => void;
  readonly onClose: () => void;
}) {
  return (
    <DialogShell title="工作区设置" eyebrow="LOCAL WORKSPACE" onClose={onClose}>
      <div className="settings-summary">
        <div><span>图表布局</span><strong className="numeric">{settings.layout} 格 / {settings.panels.length} 面板</strong></div>
        <div><span>市场</span><strong>{settings.market === 'spot' ? '现货' : 'USDⓈ-M 永续'}</strong></div>
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
      <p className="dialog__footnote" aria-live="polite">{notice}</p>
      <div className="settings-note">
        <strong>仅本机持久化</strong>
        <p>保存后刷新页面会自动恢复。响应式旋转或打开盘口抽屉不会覆盖桌面布局。清除浏览器站点数据会删除保存内容。</p>
      </div>
    </DialogShell>
  );
}

export function HelpDialog({ onClose }: { readonly onClose: () => void }) {
  return (
    <DialogShell title="操作指南" eyebrow="DEMO PLAYBOOK" onClose={onClose}>
      <div className="help-content">
        <section>
          <h3>现在可以试</h3>
          <ul>
            <li><strong>多图看盘</strong><span>切换 1 / 2 / 4 / 6 格，添加或移除面板；单图放大后按 Esc 返回。</span></li>
            <li><strong>独立周期与指标</strong><span>每个面板可选 1m–1d；工具栏为当前面板切换 SMA20、EMA50、RSI14 和成交量。</span></li>
            <li><strong>图表交互</strong><span>滚轮或双指缩放，拖动平移；普通模拟 tick 不会重置你的可视范围。</span></li>
            <li><strong>市场检查器</strong><span>点击面板或自选列表更新右侧订单簿与累计深度；移动端从“盘口”按钮打开。</span></li>
            <li><strong>本地工作区</strong><span>保存市场、主题、布局、面板与指标；刷新后自动恢复，也可读取或重置。</span></li>
          </ul>
        </section>
        <section>
          <h3>键盘快捷键</h3>
          <div className="shortcut-grid">
            <span><kbd>Ctrl / ⌘ K</kbd>搜索标的</span>
            <span><kbd>P</kbd>暂停 / 继续模拟</span>
            <span><kbd>1 / 2 / 4 / 6</kbd>切换布局</span>
            <span><kbd>Esc</kbd>关闭浮层或放大</span>
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
