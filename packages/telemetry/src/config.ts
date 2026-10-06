/**
 * Telemetry settings, read from the standard OpenTelemetry environment variables so the
 * collector address and sampling can be changed per environment without code changes.
 * Telemetry is off unless an OTLP endpoint is configured: tests and plain local runs need
 * no collector.
 */
export interface TelemetryConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  environment: string;
  /** Base URL of the OTLP/HTTP receiver (the collector), e.g. http://otel-collector:4318 */
  endpoint: string | undefined;
  metricIntervalMs: number;
}

type Env = Record<string, string | undefined>;

/** `FOO=` means unset. */
const value = (raw: string | undefined) => {
  const trimmed = raw?.trim();
  return trimmed === '' ? undefined : trimmed;
};

export function telemetryConfig(env: Env = process.env): TelemetryConfig {
  const endpoint = value(env.OTEL_EXPORTER_OTLP_ENDPOINT);
  const disabled = env.OTEL_SDK_DISABLED?.toLowerCase() === 'true';
  const interval = Number(env.OTEL_METRIC_EXPORT_INTERVAL ?? '15000');
  return {
    enabled: !disabled && endpoint !== undefined,
    serviceName: value(env.OTEL_SERVICE_NAME) ?? 'unknown-service',
    // The image tag (Git SHA) in Kubernetes; "dev" elsewhere.
    serviceVersion: value(env.SERVICE_VERSION) ?? 'dev',
    environment: value(env.DEPLOYMENT_ENVIRONMENT) ?? value(env.NODE_ENV) ?? 'development',
    endpoint,
    metricIntervalMs: Number.isFinite(interval) && interval >= 1000 ? interval : 15000,
  };
}
