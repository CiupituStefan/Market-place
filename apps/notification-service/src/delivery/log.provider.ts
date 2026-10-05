import { randomUUID } from 'node:crypto';
import type { Logger } from '@market/logger';
import type { EmailProvider, OutgoingEmail } from './provider.js';

/**
 * Development and tests: "sends" by logging the plain-text version (links
 * included) and keeping the last messages in memory. Refused in production.
 */
export class LogEmailProvider implements EmailProvider {
  readonly name = 'log';
  readonly sent: (OutgoingEmail & { messageId: string })[] = [];

  constructor(
    private readonly logger?: Logger,
    private readonly keep = 100,
  ) {}

  send(email: OutgoingEmail): Promise<{ messageId: string }> {
    const messageId = `log-${randomUUID()}`;
    this.sent.push({ ...email, messageId });
    if (this.sent.length > this.keep) this.sent.shift();
    this.logger?.info(
      { to: email.to, subject: email.subject, messageId },
      `[email not sent: EMAIL_PROVIDER=log]\n${email.text}`,
    );
    return Promise.resolve({ messageId });
  }
}
