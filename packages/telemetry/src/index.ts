// The SDK itself is started by the preload (`--import @market/telemetry/register`); the
// application only uses the vendor-neutral API below, which is a no-op without it.
export * from './config.js';
export * from './context.js';
export * from './metrics.js';
export { flushTelemetry } from './runtime.js';
