export interface OutgoingEmail {
  to: string;
  from: string;
  replyTo?: string | undefined;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

export interface EmailProvider {
  readonly name: string;
  /** Returns the provider's message id. Throws on failure. */
  send(email: OutgoingEmail): Promise<{ messageId: string }>;
}

/** The provider rejected the message for good (bad address, rejected content): no retry. */
export class PermanentDeliveryError extends Error {
  override readonly name = 'PermanentDeliveryError';
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
