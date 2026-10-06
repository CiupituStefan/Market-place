# ADR-023: OpenTelemetry everywhere; Prometheus, Tempo, Loki locally; managed backends on AWS

- Status: Accepted
- Date: 2026-10-06

## Context

One shopper action crosses up to six services and three Kafka topics. When it fails, the only
thing support has is the request ID in the error body. From that ID alone we must be able to
see:

- every service the request touched, with timings and errors;
- the database queries and outgoing calls (Stripe included);
- the asynchronous work it triggered through Kafka;
- the related log lines.

We also need request, error and latency metrics per service, business signals, and alerts that
reach a person. The services are TypeScript ES modules; Kafka is reached through a client with no
OpenTelemetry instrumentation; events leave through a transactional outbox, published later by a
relay, outside the request.

## Decision

1. **OpenTelemetry SDK, vendor-neutral, preloaded.** `@market/telemetry` is loaded with
   `node --import` before the application, so automatic instrumentation can patch ES modules:
   - HTTP in and out (`fetch`), Express, PostgreSQL, Redis, the Node.js runtime;
   - pino, whose lines gain `trace_id` and `span_id` and are also exported.

   Everything goes over OTLP to a collector. The application code uses only the OpenTelemetry
   API (domain metrics, a few spans). Without an endpoint the SDK is not started at all.

2. **Request ID and trace ID are linked, not merged.** `x-request-id` stays the human-facing
   correlation ID (error bodies, logs, emails to support). It is set as the `request.id`
   attribute on spans, and logs carry both. W3C trace context does the propagation.
3. **Trace context through the outbox and Kafka, by hand.** The request's trace context is
   stored with the outbox row (new `headers` column, additive migration). The relay publishes
   each event under a PRODUCER span and puts its `traceparent` in the Kafka headers. Consumers
   continue the trace with a CONSUMER span. A checkout and everything it causes are one trace.
4. **The collector routes and redacts.** Services know only the collector address. The
   collector:
   - sends each signal to its store;
   - removes query strings from span attributes before anything is stored, because they can
     hold single-use tokens;
   - is the only component with backend credentials.

   Clients' trace headers are dropped at the gateway.

5. **Backends.**
   - **Locally (Compose profile):** Prometheus (OTLP receiver, alert rules), Tempo (with
     service graph and span metrics), Loki and Grafana, all provisioned from the repository.
   - **AWS (managed, rule 14):** Amazon Managed Service for Prometheus for metrics and alert
     rules (Alertmanager → SNS → email), AWS X-Ray for traces (`request.id` indexed as an
     annotation), CloudWatch Logs for logs and Amazon Managed Grafana for dashboards.
   - The alert rules and dashboards are the same files in both, and both are tested in CI.
6. **Dashboards as code, synced by the deploy.** Each deploy writes the deployed commit's
   dashboards into Amazon Managed Grafana with a 15-minute service-account token. No long-lived
   Grafana credential exists.

## Alternatives considered

- **Prometheus scraping `/metrics` on every pod** (prom-client): the classic setup. It needs
  scrape configuration (ServiceMonitors or annotations) kept in step with the services, and
  gives no traces or log correlation. OTLP push through the same collector serves all three
  signals with one SDK. The cost is that "is it up" becomes "did it report recently"
  (`ServiceSilent`).
- **A self-hosted LGTM stack in the cluster** (kube-prometheus-stack, Tempo, Loki): one
  toolset everywhere, but storage, retention, upgrades and high availability of four stateful
  systems become our job. Managed services remove that (rule 14). The local stack keeps the
  development experience the same.
- **Amazon CloudWatch Application Signals / ADOT agents**: less setup on AWS, but tied to AWS
  and with different local tooling. The upstream collector with AWS exporters keeps the
  services vendor-neutral.
- **Logs only from stdout via Fluent Bit**: the standard EKS path. Exporting through the same
  OTLP pipeline gives the same correlation fields with one fewer DaemonSet. Stdout remains the
  primary stream (`kubectl logs` always works).
- **Making the trace ID the request ID**: one ID instead of two, but trace IDs change with
  sampling and propagation rules, and the request ID is already part of the error contract
  (rule: `{error:{code,message,requestId}}`).

## Consequences

- Every service image carries the SDK (about 35 MB of dependencies). Telemetry costs a little
  CPU per request (batching, sampling in production).
- Kafka tracing is our code, not a library's. Tests cover the propagation, and a client switch
  must keep the headers.
- Alerts based on pushed telemetry need care: no data is not the same as healthy.
  `ServiceSilent` covers a service that disappears.
- Amazon Managed Grafana needs IAM Identity Center. The dashboards use schema 39 (Grafana 10.4)
  so they import into the managed version.
- Browser-side tracing (web vitals, client errors) is not covered. The browser's requests are
  correlated by the request ID the gateway assigns.
