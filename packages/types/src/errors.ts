import { z } from 'zod';

/**
 * Stable, machine-readable error codes shared by every service and the frontend.
 * Codes are part of the public API contract: never rename, only add.
 */
export const ErrorCode = {
  // generic
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  UPSTREAM_TIMEOUT: 'UPSTREAM_TIMEOUT',
  // auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  // catalog / inventory
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  VARIANT_NOT_FOUND: 'VARIANT_NOT_FOUND',
  PRODUCT_OUT_OF_STOCK: 'PRODUCT_OUT_OF_STOCK',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVALID_CONFIGURATION: 'INVALID_CONFIGURATION',
  // cart / checkout
  CART_NOT_FOUND: 'CART_NOT_FOUND',
  CART_EMPTY: 'CART_EMPTY',
  COUPON_INVALID: 'COUPON_INVALID',
  COUPON_EXPIRED: 'COUPON_EXPIRED',
  PRICE_CHANGED: 'PRICE_CHANGED',
  // orders / payments
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  INVALID_ORDER_STATE: 'INVALID_ORDER_STATE',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  REFUND_EXCEEDS_PAYMENT: 'REFUND_EXCEEDS_PAYMENT',
  WEBHOOK_SIGNATURE_INVALID: 'WEBHOOK_SIGNATURE_INVALID',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  UPSTREAM_TIMEOUT: 504,
  INVALID_CREDENTIALS: 401,
  EMAIL_ALREADY_REGISTERED: 409,
  EMAIL_NOT_VERIFIED: 403,
  TOKEN_EXPIRED: 401,
  INVALID_TOKEN: 400,
  PRODUCT_NOT_FOUND: 404,
  VARIANT_NOT_FOUND: 404,
  PRODUCT_OUT_OF_STOCK: 409,
  INSUFFICIENT_STOCK: 409,
  INVALID_CONFIGURATION: 422,
  CART_NOT_FOUND: 404,
  CART_EMPTY: 422,
  COUPON_INVALID: 422,
  COUPON_EXPIRED: 422,
  PRICE_CHANGED: 409,
  ORDER_NOT_FOUND: 404,
  INVALID_ORDER_STATE: 409,
  PAYMENT_FAILED: 402,
  REFUND_EXCEEDS_PAYMENT: 422,
  WEBHOOK_SIGNATURE_INVALID: 400,
  IDEMPOTENCY_KEY_REUSED: 422,
};

export function httpStatusFor(code: ErrorCode): number {
  return ERROR_STATUS[code];
}

export const ErrorCodeSchema = z.enum(Object.values(ErrorCode) as [ErrorCode, ...ErrorCode[]]);

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    requestId: z.string(),
    /** Field-level validation issues; never contains stack traces. */
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

/**
 * Domain error thrown by service code. HTTP layers translate it into an
 * ApiErrorBody; it carries no transport concerns itself.
 */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details: ApiErrorBody['error']['details'];

  constructor(code: ErrorCode, message: string, details?: ApiErrorBody['error']['details']) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }

  get status(): number {
    return httpStatusFor(this.code);
  }
}

export function toApiErrorBody(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: ApiErrorBody['error']['details'],
): ApiErrorBody {
  return { error: { code, message, requestId, ...(details ? { details } : {}) } };
}
