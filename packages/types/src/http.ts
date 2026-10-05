/** Header used to propagate the correlation ID across every hop (gateway → services → Kafka). */
export const REQUEST_ID_HEADER = 'x-request-id';

/** Header carrying the idempotency key for unsafe operations (orders, payments). */
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

export const API_PREFIX = 'api/v1';
