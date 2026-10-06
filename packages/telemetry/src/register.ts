/**
 * Preloaded before the application so instrumentation can patch modules as they are first
 * imported:  node --import @market/telemetry/register dist/main.js
 *
 * ES modules cannot be patched after the fact, so the import-in-the-middle loader hook is
 * registered here, limited to the modules an instrumentation asked for. Does nothing when no
 * OTLP endpoint is configured.
 */
import { register } from 'node:module';
import { createAddHookMessageChannel } from 'import-in-the-middle';
import { telemetryConfig } from './config.js';
import { setActiveTelemetry } from './runtime.js';
import { startTelemetry } from './sdk.js';

const config = telemetryConfig();

if (config.enabled) {
  const { registerOptions, waitForAllMessagesAcknowledged } = createAddHookMessageChannel();
  register('import-in-the-middle/hook.mjs', import.meta.url, registerOptions);
  setActiveTelemetry(startTelemetry(config));
  // The instrumentations' module hooks must reach the loader before the app is imported.
  await waitForAllMessagesAcknowledged();
}
