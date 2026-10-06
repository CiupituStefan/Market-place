import { registerOTel } from '@vercel/otel';

/**
 * OpenTelemetry for the server side of the storefront (Next.js calls this once at startup).
 * Traces page renders and route handlers, and carries the trace context on server-side
 * fetches to the API, so a page render and the services it called form one trace.
 * Off unless an OTLP endpoint is configured (same switch as the services).
 */
export function register(): void {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_SDK_DISABLED === 'true') return;

  const apiUrls = [process.env.API_INTERNAL_URL, process.env.NEXT_PUBLIC_API_URL].filter(
    (url): url is string => typeof url === 'string' && url !== '',
  );
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'web',
    attributes: {
      'service.version': process.env.SERVICE_VERSION ?? 'dev',
      'deployment.environment.name': process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV,
    },
    instrumentationConfig: {
      fetch: {
        // Only our own API receives the trace context; third parties never do.
        propagateContextUrls: apiUrls,
        ignoreUrls: [/\/health\//],
      },
    },
  });
}
