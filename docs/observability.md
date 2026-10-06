# Observability

Every service emits **traces, metrics and logs with OpenTelemetry** over OTLP to a collector,
which routes each signal to its store. Every request has a **request ID** (`x-request-id`) that
appears in:

- the error body support sees (`error.requestId`);
- every log line (`request_id`);
- every span (`request.id`), including the Kafka consumers the request triggered.

| Signal  | Local (`--profile observability`) | AWS                                          | Searched by request ID with                                    |
| ------- | --------------------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| Traces  | Tempo                             | AWS X-Ray                                    | `{ span."request.id" = "…" }` / `annotation.request_id = "…"`  |
| Metrics | Prometheus                        | Amazon Managed Service for Prometheus        | (aggregates)                                                   |
| Logs    | Loki                              | CloudWatch Logs `/cse/cse-<env>/application` | `\| request_id="…"` / Logs Insights `filter @message like "…"` |
| UI      | Grafana `http://localhost:3001`   | Amazon Managed Grafana (IAM Identity Center) |                                                                |

```
service ──OTLP──▶ collector ──▶ traces  ─▶ Tempo / X-Ray
 (SDK preload)      │ redacts query strings   metrics ─▶ Prometheus / AMP ─▶ alert rules ─▶ (local UI) / SNS e-mail
                    └────────────────────▶ logs    ─▶ Loki / CloudWatch Logs
```

## Following one request end to end

A checkout traced locally, as Tempo shows it (one trace, ~50 spans):

```
api-gateway           SERVER    POST /api/v1/orders
  order-service       SERVER    POST /api/v1/orders              (+ every SQL query)
    cart-service      SERVER    POST /internal/carts/priced
      product-service SERVER    POST /internal/variants/lookup
      inventory-svc   SERVER    POST /internal/availability
    inventory-svc     SERVER    POST /internal/reservations
  order-service       PRODUCER  publish orders.order.events      (from the outbox)
    admin-service         CONSUMER process orders.order.events
    notification-service  CONSUMER process orders.order.events
    review-service        CONSUMER process orders.order.events
```

The payment that follows (`POST /payments/mock/confirm`, or Stripe's webhook) is its own trace:

payment-service → order-service → inventory-service → `orders.order.events` → five consumers.

**Locally:**

- Take the request ID from the error body or the `x-request-id` response header.
- Grafana → Explore → Tempo: `{ span."request.id" = "<id>" }`. The quotes are needed because
  the attribute name contains a dot.
- From any span, **Logs for this span** opens its Loki lines. From any Loki line, **Open trace**
  goes back to the trace.
- **Service graph** (Tempo) draws who calls whom, with rates and errors.

**AWS:**

- X-Ray → Traces: `annotation.request_id = "<id>"` (`request.id` is indexed as an annotation).
- CloudWatch Logs Insights, on the application log group:
  ```
  fields @timestamp, @message
  | filter @message like "<id>"
  | sort @timestamp asc
  ```

## How it works

- **[`@market/telemetry`](../packages/telemetry)** is preloaded before the application
  (`node --import @market/telemetry/register`). The services are ES modules, so it registers the
  module hooks that let instrumentation patch libraries as they load. It instruments:
  - HTTP in and out (`fetch`), Express and PostgreSQL;
  - Redis (the gateway's rate limits);
  - pino: `trace_id`/`span_id` added to every log line, which is also sent over OTLP;
  - the Node.js runtime.

  Without `OTEL_EXPORTER_OTLP_ENDPOINT` it does nothing (tests, plain `pnpm dev`).

- **Request ID ↔ trace.** The request-context middleware tags the server span with `request.id`.
  Logs carry both `request_id` and `trace_id`.
- **Kafka has no automatic instrumentation**, so the trace crosses it by hand:
  1. `enqueueEvent` stores the W3C trace context of the request in the outbox row
     (`outbox_events.headers`).
  2. The relay publishes each event under a PRODUCER span, with that context in the Kafka
     headers (`traceparent`).
  3. The consumer continues it with a CONSUMER span: retries are span events, dead-lettering
     marks the span failed, and the handler's queries are its children.
- **The gateway** names spans and request metrics after the matched route
  (`POST /api/v1/orders`), not its catch-all path. It also drops clients' `traceparent`,
  `tracestate` and `baggage`: traces start at our edge.
- **The web app** (Next.js `instrumentation.ts`, `@vercel/otel`) traces server rendering and
  passes the context on its server-side calls to the API, and only to the API.
- **Redaction.**
  - The collector replaces query strings in span attributes (`url.query`, `url.full`,
    `http.target`) before export. They can hold single-use tokens: email verification,
    password reset, unsubscribe.
  - Log redaction (passwords, tokens, cookies) happens in pino, before export.
  - Both are tested.
- **Sampling.** Every trace locally and on staging. 25% of new traces in production
  (`global.telemetry.tracesSampleRatio`), parent-based, so a trace is kept or dropped whole.
  Metrics and logs are never sampled.

## Metrics

**From instrumentation:**

| Metric                                 | Source                                                        |
| -------------------------------------- | ------------------------------------------------------------- |
| `http_server_request_duration_seconds` | by `job` (service), `http_route`, `http_response_status_code` |
| `http_client_request_duration_seconds` | service-to-service calls and Stripe                           |
| `db_client_operation_duration_seconds` | PostgreSQL                                                    |
| `nodejs_eventloop_*`, `v8js_*`         | Node.js runtime                                               |

**Domain metrics:**

| Metric                                 | Labels                                                    |
| -------------------------------------- | --------------------------------------------------------- |
| `cse_orders_created_total`             |                                                           |
| `cse_orders_cancelled_total`           | `reason`                                                  |
| `cse_checkouts_failed_total`           | `reason` (error code)                                     |
| `cse_payments_total`                   | `outcome`: succeeded, failed, refunded (from the webhook) |
| `cse_events_published_total`           | `topic`                                                   |
| `cse_events_consumed_total`            | `topic`, `outcome`: processed, duplicate, retried         |
| `cse_events_dead_lettered_total`       | `topic`                                                   |
| `cse_events_handling_duration_seconds` | `topic`                                                   |
| `cse_outbox_lag_seconds`               | `topic`; from writing an event to publishing it           |

**Dashboards** ([source](../infrastructure/observability/grafana/dashboards)):

- **Services**: RED per service and route, outgoing calls, event loop, heap, database.
- **Business**: orders, payments, checkout failures, cancellations.
- **Events**: published, handled, dead-lettered, outbox lag.

Locally they are provisioned from the files. In AWS the deploy pipeline syncs them into
Amazon Managed Grafana on every deploy (`scripts/grafana-sync.sh`, with a 15-minute token).

## Alerts

[`alerts.yml`](../infrastructure/observability/prometheus/alerts.yml) is loaded by local
Prometheus and, through Terraform, by Amazon Managed Prometheus. Its Alertmanager sends to an
SNS topic with an email subscription (`alert_email`). `promtool` unit tests cover every rule.
Each alert links to its [runbook](runbooks.md).

| Alert               | Fires when                                             |
| ------------------- | ------------------------------------------------------ |
| HighErrorRate       | > 5% 5xx for 10 min (with real traffic)                |
| HighLatency         | p95 > 1 s for 10 min                                   |
| ServiceSilent       | a service that reported an hour ago stopped            |
| EventLoopBlocked    | event loop delay p99 > 0.5 s for 5 min                 |
| EventsDeadLettered  | any event dead-lettered in 10 min                      |
| OutboxLagging       | events reach Kafka > 60 s late (p95, 10 min)           |
| PaymentFailureSpike | > 30% of payment attempts fail (≥ 10 attempts, 10 min) |
| CheckoutsFailing    | ≥ 3 checkouts failed for unexpected reasons in 10 min  |

## Running it locally

```bash
docker compose --profile observability up -d     # adds collector, Prometheus, Tempo, Loki, Grafana
open http://localhost:3001                        # dashboards; Explore for traces and logs
open http://localhost:9090/alerts                 # alert rules and their state
```

The services always send to `http://otel-collector:4318`. Without the profile, exports fail
quietly and nothing else changes. Data reaches Grafana 10–40 seconds after it happens (batching
in the SDK, the collector and the stores).

`infrastructure/observability/check.sh` (also in CI) runs:

- `promtool` for the rules and their tests;
- the collector's own `validate`;
- dashboard JSON checks.

## Kubernetes and AWS

The platform stack runs the collector (two replicas, namespace `observability`). Its IRSA role
may do only three things:

- remote-write to this environment's Prometheus workspace;
- put trace segments to X-Ray;
- write to this environment's application log group.

The chart points every component at it (`global.telemetry.endpoint`). Each component is named
after itself, versioned with the image tag and labelled with the environment. See
[ADR-023](adr/ADR-023-observability.md) for the choices.
