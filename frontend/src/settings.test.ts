import { expect, test } from 'bun:test';
import { createPanel } from './settings';

test('creates distinct panels when randomUUID is unavailable on an HTTP origin', () => {
  // Given: VPN HTTP pages expose getRandomValues but not randomUUID.
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: undefined,
  });
  try {
    // When: the owner adds enough panels for a six-window workspace.
    const panels = Array.from({ length: 6 }, () => createPanel('BTCUSDT'));

    // Then: each panel has a distinct identity without requiring HTTPS.
    expect(new Set(panels.map((panel) => panel.id)).size).toBe(6);
    expect(panels.every((panel) => panel.symbol === 'BTCUSDT')).toBe(true);
  } finally {
    if (descriptor === undefined) {
      Reflect.deleteProperty(crypto, 'randomUUID');
    } else {
      Object.defineProperty(crypto, 'randomUUID', descriptor);
    }
  }
});
