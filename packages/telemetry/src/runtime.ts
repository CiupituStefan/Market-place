import type { StartedTelemetry } from './sdk.js';

// Shared through globalThis: the preload (register.js) and the application may load this
// module through different specifiers.
const KEY = Symbol.for('@market/telemetry');
interface Holder {
  [KEY]?: StartedTelemetry;
}

export function setActiveTelemetry(telemetry: StartedTelemetry): void {
  (globalThis as Holder)[KEY] = telemetry;
}

/**
 * Exports buffered spans, metrics and logs. Called on shutdown, after the application has
 * stopped taking work, so the last requests' telemetry is not lost. No-op without the SDK.
 */
export async function flushTelemetry(): Promise<void> {
  await (globalThis as Holder)[KEY]?.shutdown();
}
