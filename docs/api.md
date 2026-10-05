# API conventions

All public endpoints are served by the **api-gateway** under `/api/v1`. Each service publishes its
own OpenAPI document at `/openapi.json`; in non-production environments the gateway serves a
combined Swagger UI at **`/docs`**.

## Resources and routing

| Path prefix                                                             | Service              |
| ----------------------------------------------------------------------- | -------------------- |
| `/api/v1/auth`, `/api/v1/users`                                         | auth-service         |
| `/api/v1/products` (incl. `?q=` search), `/categories`, `/configurator` | product-service      |
| `/api/v1/inventory`                                                     | inventory-service    |
| `/api/v1/cart`, `/wishlist`, `/discounts`                               | cart-service         |
| `/api/v1/orders`                                                        | order-service        |
| `/api/v1/payments` (incl. `/webhook`)                                   | payment-service      |
| `/api/v1/newsletter`, `/notifications`                                  | notification-service |
| `/api/v1/reviews`                                                       | review-service       |
| `/api/v1/admin`                                                         | admin-service        |

Endpoint style:

```
GET    /api/v1/products            list (paginated: ?page=&pageSize=)
GET    /api/v1/products/:id        read
POST   /api/v1/products            create
PATCH  /api/v1/products/:id        partial update
DELETE /api/v1/products/:id        delete
POST   /api/v1/payments/create-intent   command endpoints use verbs
```

- JSON bodies, `camelCase` fields, ISO-8601 UTC timestamps.
- Money is always `{ "amount": <integer minor units>, "currency": "EUR" }`.
- Lists return `{ items, page, pageSize, total, totalPages }`.
- Unsafe operations that must not run twice (orders, payments) accept an `Idempotency-Key` header.
- Paths containing an `internal` segment are service-to-service only and are not reachable through
  the gateway.

## Errors

Every error, from every service and from the gateway itself, has the same shape:

```json
{
  "error": {
    "code": "PRODUCT_OUT_OF_STOCK",
    "message": "Product is currently out of stock",
    "requestId": "8d7d0c5e-3a7e-4c62-9a43-6f1f6a3d2b10",
    "details": [{ "path": "quantity", "message": "Too big: expected number to be <=10" }]
  }
}
```

- `code` is stable and machine-readable (`packages/types/src/errors.ts`); codes are only ever added.
- `details` appears for validation errors only.
- 5xx responses always say `"Internal server error"`: stack traces and internal messages are
  logged with the `requestId`, never returned.

| HTTP | Typical codes                                             |
| ---- | --------------------------------------------------------- |
| 400  | `VALIDATION_FAILED`, `WEBHOOK_SIGNATURE_INVALID`          |
| 401  | `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `TOKEN_EXPIRED` |
| 403  | `FORBIDDEN` (incl. blocked cross-site requests)           |
| 404  | `NOT_FOUND`, `PRODUCT_NOT_FOUND`, `ORDER_NOT_FOUND`       |
| 409  | `CONFLICT`, `INSUFFICIENT_STOCK`, `PRICE_CHANGED`         |
| 413  | `PAYLOAD_TOO_LARGE`                                       |
| 422  | `COUPON_INVALID`, `INVALID_CONFIGURATION`                 |
| 429  | `RATE_LIMITED` (+ `Retry-After`)                          |
| 503  | `SERVICE_UNAVAILABLE`                                     |
| 504  | `UPSTREAM_TIMEOUT`                                        |

## Headers

| Header                            | Direction | Meaning                                              |
| --------------------------------- | --------- | ---------------------------------------------------- |
| `x-request-id`                    | both      | Correlation ID; send one or the gateway generates it |
| `Idempotency-Key`                 | request   | Deduplicates unsafe commands (orders, payments)      |
| `RateLimit-Limit/Remaining/Reset` | response  | Current rate-limit window                            |
| `Retry-After`                     | response  | Seconds to wait after a 429                          |

## Validation

Request bodies and queries are validated with Zod schemas (`ZodValidationPipe` from
`@market/nest-common`). The same schema generates the OpenAPI definition (`openApiSchema()`), so
documentation cannot drift from validation.
