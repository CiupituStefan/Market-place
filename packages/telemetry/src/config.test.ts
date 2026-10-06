import { describe, expect, it } from 'vitest';
import { telemetryConfig } from './config.js';

describe('telemetryConfig', () => {
  it('is off without an OTLP endpoint (tests, plain local runs)', () => {
    expect(telemetryConfig({}).enabled).toBe(false);
    expect(telemetryConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: '' }).enabled).toBe(false);
  });

  it('is on with an endpoint, unless explicitly disabled', () => {
    const env = { OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel-collector:4318' };
    expect(telemetryConfig(env).enabled).toBe(true);
    expect(telemetryConfig({ ...env, OTEL_SDK_DISABLED: 'true' }).enabled).toBe(false);
  });

  it('describes the service: name, version (image tag) and environment', () => {
    const config = telemetryConfig({
      OTEL_SERVICE_NAME: 'order-service',
      SERVICE_VERSION: '3f9c2e1',
      DEPLOYMENT_ENVIRONMENT: 'staging',
    });
    expect(config).toMatchObject({
      serviceName: 'order-service',
      serviceVersion: '3f9c2e1',
      environment: 'staging',
    });
    expect(telemetryConfig({ NODE_ENV: 'production' }).environment).toBe('production');
  });

  it('rejects a metric interval below one second', () => {
    expect(telemetryConfig({ OTEL_METRIC_EXPORT_INTERVAL: '10' }).metricIntervalMs).toBe(15000);
    expect(telemetryConfig({ OTEL_METRIC_EXPORT_INTERVAL: '5000' }).metricIntervalMs).toBe(5000);
  });
});
