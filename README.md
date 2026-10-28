# tradingmonitor

自适应看盘应用的前端 Demo，支持手机、平板、电脑和投影设备。

## 运行

需要 Bun 1.4 或更新版本。项目依赖安装并构建后，由一个静态服务提供页面：

```bash
bun install
bun run check
bun test
bun run build
bun run start
```

默认监听 `0.0.0.0:8080`，可通过已有 VPN 访问当前机器的地址。
`HOST` 和 `PORT` 可配置，例如 `PORT=8081 bun run start`。
`0.0.0.0` 表示所有网络接口，应用不负责配置 VPN 或防火墙。

## 演示范围

- 多标的、多周期图表及 1/2/4/6 窗口布局。
- 模拟动态 K 线、成交量，以及前端计算的 SMA、EMA、RSI 示例。
- 现货/合约标识、订单簿和深度可视化。
- 暂停/恢复、明暗主题、面板放大、布局保存与恢复。
- 自适应窄屏和宽屏；1920×1080 是支持的尺寸之一。

行情全部为模拟数据。当前版本没有接入币安、NautilusTrader、账户或交易功能。
保存的数据仅保存在当前浏览器，不会同步到其他设备；清理站点数据会移除保存的设置。
本 Demo 的指标在前端计算，用来展示交互和接入后的表现，不代表已验证你的自研因子。

图表由 [TradingView Lightweight Charts](https://www.tradingview.com/) 提供。
