import { ApiErrorBodySchema, ErrorCode, type ApiErrorBody } from '@market/types';

/** Error raised for any non-2xx API response, carrying the standard error body. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly requestId: string | null;
  readonly details: ApiErrorBody['error']['details'];

  constructor(status: number, body: ApiErrorBody['error'] | null, fallbackMessage: string) {
    super(body?.message ?? fallbackMessage);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code ?? (status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.CONFLICT);
    this.requestId = body?.requestId ?? null;
    this.details = body?.details;
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody['error'] | null = null;
  try {
    const parsed = ApiErrorBodySchema.safeParse(await response.json());
    if (parsed.success) body = parsed.data.error;
  } catch {
    // Non-JSON error (proxy, load balancer): keep the generic message.
  }
  return new ApiError(response.status, body, `Request failed with status ${response.status}`);
}

/** The part of the dictionary error messages come from. */
interface ErrorMessages {
  errors: {
    preferServerMessage: boolean;
    server: string;
    offline: string;
    generic: string;
    codes: Partial<Record<string, string>>;
  };
}

/**
 * Message safe to show to a shopper, in their language. Server-side details stay in the logs.
 * Without a dictionary (back office), the API's English message is used.
 */
export function userMessage(error: unknown, t?: ErrorMessages): string {
  const messages = t?.errors;
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      return messages?.server ?? 'Something went wrong on our side. Please try again.';
    }
    if (!messages || messages.preferServerMessage) return error.message;
    return messages.codes[error.code] ?? messages.generic;
  }
  if (error instanceof TypeError) {
    return messages?.offline ?? 'We could not reach the store. Check your connection.';
  }
  return messages?.generic ?? 'Something went wrong. Please try again.';
}
