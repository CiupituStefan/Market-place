import type { IncomingMessage } from 'node:http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation, ExpressLayerType } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  type LogRecordExporter,
  type LogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  PeriodicExportingMetricReader,
  type MetricReader,
  type PushMetricExporter,
} from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  BatchSpanProcessor,
  type SpanExporter,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import type { TelemetryConfig } from './config.js';

/** Not yet in the stable semantic conventions export. */
const ATTR_DEPLOYMENT_ENVIRONMENT = 'deployment.environment.name';

export interface TelemetryExporters {
  spans: SpanExporter;
  metrics: PushMetricExporter;
  logs: LogRecordExporter;
}

export interface StartedTelemetry {
  /** Exports everything still buffered, then stops. Safe to call more than once. */
  shutdown: () => Promise<void>;
}

/** Probes are frequent and say nothing about user traffic: no spans for them. */
function isProbe(request: IncomingMessage): boolean {
  const url = request.url ?? '';
  return url.startsWith('/health/') || url === '/api/health' || url === '/metrics';
}

export function instrumentations(): Instrumentation[] {
  return [
    new HttpInstrumentation({ ignoreIncomingRequestHook: isProbe }),
    // fetch (service-to-service calls): carries the trace context to the next service.
    new UndiciInstrumentation(),
    // Route handlers only: a span per middleware (body parsers, CORS...) is noise.
    new ExpressInstrumentation({ ignoreLayersType: [ExpressLayerType.MIDDLEWARE] }),
    new NestInstrumentation(),
    // Only queries made while handling something: no orphan spans for pool housekeeping.
    new PgInstrumentation({ requireParentSpan: true, enhancedDatabaseReporting: false }),
    new IORedisInstrumentation({ requireParentSpan: true }),
    // Adds trace_id/span_id to every log line and sends the logs over OTLP as well
    // (stdout stays the primary, always-available log stream).
    new PinoInstrumentation(),
    new RuntimeNodeInstrumentation(),
  ];
}

/**
 * Starts the OpenTelemetry SDK: traces, metrics and logs exported over OTLP/HTTP (protobuf)
 * to the collector. `exporters` replaces the OTLP exporters (tests).
 */
export function startTelemetry(
  config: TelemetryConfig,
  exporters?: Partial<TelemetryExporters>,
): StartedTelemetry {
  const base = config.endpoint?.replace(/\/$/, '') ?? 'http://localhost:4318';
  const spanExporter = exporters?.spans ?? new OTLPTraceExporter({ url: `${base}/v1/traces` });
  const metricExporter =
    exporters?.metrics ?? new OTLPMetricExporter({ url: `${base}/v1/metrics` });
  const logExporter = exporters?.logs ?? new OTLPLogExporter({ url: `${base}/v1/logs` });

  const spanProcessors: SpanProcessor[] = [new BatchSpanProcessor(spanExporter)];
  const logRecordProcessors: LogRecordProcessor[] = [
    new BatchLogRecordProcessor({ exporter: logExporter }),
  ];
  const metricReader: MetricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: config.metricIntervalMs,
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion,
      [ATTR_DEPLOYMENT_ENVIRONMENT]: config.environment,
    }),
    spanProcessors,
    metricReaders: [metricReader],
    logRecordProcessors,
    instrumentations: instrumentations(),
  });
  sdk.start();

  let stopping: Promise<void> | undefined;
  return {
    shutdown: () => (stopping ??= sdk.shutdown().catch(() => undefined)),
  };
}
