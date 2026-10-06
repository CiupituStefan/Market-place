import { getRPCMetadata, RPCType } from '@opentelemetry/core';
import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Context,
  type Span,
} from '@opentelemetry/api';

export { SpanKind } from '@opentelemetry/api';

const TRACER = 'cse';

/** W3C trace context of the active span, to carry across Kafka (or anything not HTTP). */
export function currentTraceContext(): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier;
}

/** The context carried by `carrier` (e.g. Kafka message headers), or the active one. */
export function contextFrom(carrier: Record<string, string | undefined> | undefined): Context {
  return carrier ? propagation.extract(context.active(), carrier) : context.active();
}

/** Marks the active span (the inbound HTTP request) with the request's correlation ID. */
export function tagActiveSpan(attributes: Attributes): void {
  trace.getActiveSpan()?.setAttributes(attributes);
}

/**
 * Runs `fn` inside a new span (child of `parent`, default: the active context). Errors are
 * recorded on the span and re-thrown. Without the SDK the span is a no-op.
 */
export async function withSpan<T>(
  name: string,
  options: { kind?: SpanKind; attributes?: Attributes; parent?: Context },
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer(TRACER);
  return tracer.startActiveSpan(
    name,
    { kind: options.kind ?? SpanKind.INTERNAL, attributes: options.attributes ?? {} },
    options.parent ?? context.active(),
    async (span) => {
      try {
        return await fn(span);
      } catch (error) {
        failSpan(span, error);
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

/** Records an unexpected error on the active span (the request it broke). */
export function recordError(error: unknown): void {
  const span = trace.getActiveSpan();
  if (span) failSpan(span, error);
}

/** Starts a span that is not made active (e.g. one per message in a batch). End it yourself. */
export function startSpan(
  name: string,
  options: { kind?: SpanKind; attributes?: Attributes; parent?: Context },
): Span {
  return trace
    .getTracer(TRACER)
    .startSpan(
      name,
      { kind: options.kind ?? SpanKind.INTERNAL, attributes: options.attributes ?? {} },
      options.parent ?? context.active(),
    );
}

/** W3C trace context naming `span` as the parent, to put in an outgoing message's headers. */
export function traceContextOf(span: Span): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(trace.setSpan(context.active(), span), carrier);
  return carrier;
}

/** Marks a span as failed, with the error that caused it. */
export function failSpan(span: Span, error: unknown): void {
  span.recordException(error instanceof Error ? error : String(error));
  span.setStatus({ code: SpanStatusCode.ERROR });
}

export type { Span } from '@opentelemetry/api';

/**
 * Names the HTTP route of the current request (span name and the `http.route` attribute of the
 * request metrics). For handlers mounted on a catch-all path, like the gateway's proxy, which
 * know the real route only after matching it themselves. Use a template, never a raw path:
 * it is a metric label.
 */
export function setHttpRoute(route: string): void {
  const rpc = getRPCMetadata(context.active());
  if (rpc?.type === RPCType.HTTP) rpc.route = route;
}
