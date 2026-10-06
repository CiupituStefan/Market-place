# Runbooks

One section per alert ([rules](../infrastructure/observability/prometheus/alerts.yml)). Each
alert's `runbook_url` points here.

Start every investigation the same way:

1. Open the **Services** dashboard for the alert's `job`.
2. Find a failing request.
3. Follow its trace ([observability](observability.md#following-one-request-end-to-end)).

Useful commands:

```bash
kubectl -n cse-production get pods -l app.kubernetes.io/name=<service>
kubectl -n cse-production logs deploy/<service> --since=15m | jq 'select(.level=="error")'
HELM_DRIVER=configmap helm -n cse-production history marketplace
```

## HighErrorRate

More than 5% of a service's requests end in 5xx.

1. **Did a deploy just happen?** Check `helm history` and the Deploy production run. If the
   errors started with it, roll back first and investigate after
   ([deployment](deployment.md#rolling-back)).
2. **Find the errors.** Services dashboard → "p95 latency by route" and "Responses by status
   class". In Tempo: `{ resource.service.name = "<job>" && status = error }`. The failing span's
   exception event names the cause. Logs: `{service_name="<job>"} | level="error"`.
3. **Common causes:**
   - a dependency is down: an outgoing call span fails, and `SERVICE_UNAVAILABLE` appears in
     the logs. Check that service's alerts;
   - the database: connection errors, or `db_client_operation_duration_seconds` rising;
   - a bad migration: the init container's logs.
4. **The gateway** returns 502/503/504 when an upstream fails or times out. The upstream's own
   dashboard shows which.

## HighLatency

The p95 of a service's requests is above 1 s.

1. Look at "p95 latency by route": one route, or all of them?
2. **One route:** open a slow trace. Is the time in a query (index? lock waits?), in a call to
   another service, or in Stripe (`http_client_request_duration_seconds` to `api.stripe.com`)?
3. **All routes:** look at event loop delay (CPU-bound work, large JSON), at CPU throttling
   (`kubectl top pods` against limits) and at the HPA (is it at max replicas?).
4. Database-wide slowness: RDS Performance Insights for the instance.

## ServiceSilent

A service stopped sending telemetry: crash-looping, unschedulable, or unable to reach the
collector.

1. `kubectl -n cse-<env> get pods` for the service, then `describe` and `logs --previous`.
2. **Pods are healthy but silent:** check the collector. Run
   `kubectl -n observability get pods`; its logs show export errors (IAM, endpoint). If every
   service is silent, it is the collector.
3. **Pods fail readiness:** `/health/ready` checks the database and Kafka. Look at those first.

## EventLoopBlocked

Event loop delay p99 above 0.5 s: requests on that pod queue behind synchronous work.

1. Is it one pod or all of them? (A heap near its limit means GC pressure. Check the heap panel.)
2. Correlate with traffic and with the routes that got slower. Large payloads (image metadata,
   admin exports) and synchronous crypto (password hashing bursts at sign-in) are the usual
   suspects.
3. Short term: scale out (the HPA may already). Long term: move the work off the request path.

## EventsDeadLettered

A consumer gave up on an event after its retries, or the event was invalid. Something
downstream did not happen: a stock update, a confirmation email, a refund, an analytics row.

1. Find it in Kafka: topic `<topic>.dlq`. The headers say why: `dlq-reason`, `dlq-error`,
   `dlq-consumer`, `dlq-attempts` and the original topic, partition and offset. Locally, use
   Kafka UI (http://localhost:8080).
2. Its trace (`traceparent` header, or `request.id`) shows the failing handler span with the
   exception.
3. Fix the cause, then re-publish the original message to its topic. Handlers are idempotent
   (inbox), so a duplicate is harmless. `invalid-event` means a contract mismatch between
   producer and consumer versions: fix the code, do not replay blindly.

## OutboxLagging

Events wait in a service's outbox for more than a minute. Orders are still placed, but payments,
emails, stock and analytics stop hearing about them.

1. Is Kafka (MSK) reachable? Look for broker errors in the service's logs. In AWS, the MSK
   console (broker health, disk).
2. Is the relay running? It logs failures with backoff. `outbox_events.attempts` grows on stuck
   rows.
3. **One service only:** its pods may be unable to authenticate (SCRAM secret rotated without a
   restart). Restart the deployment after a rotation.

## PaymentFailureSpike

More than 30% of payment attempts fail.

1. **Stripe status:** status.stripe.com. Look also at the Stripe dashboard for decline codes.
   A spike of `card_declined` from one BIN or region points to fraud testing.
2. **Card testing** (many small attempts, many cards): tighten the WAF rate limit on
   `/api/v1/payments`, enable Stripe Radar rules, consider requiring sign-in for checkout.
3. **Integration error** (all attempts fail): check for a rotated Stripe key or webhook secret
   (payment-service logs: signature failures) and the latest deploy.

## CheckoutsFailing

Checkouts fail with `UNEXPECTED`, `SERVICE_UNAVAILABLE` or `INTERNAL_ERROR`. Refusals such as
out-of-stock are not counted.

1. The **Business** dashboard shows the reason. Tempo:
   `{ resource.service.name = "order-service" && name = "POST /api/v1/orders" && status = error }`.
2. `SERVICE_UNAVAILABLE`: cart-, inventory- or product-service is down or slow. The trace shows
   which call failed. Follow that service's alerts.
3. Failed checkouts release their reservations and coupon claims (saga compensation).
   Reservations that could not be released expire on their own.
