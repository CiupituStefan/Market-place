import { expect, type APIRequestContext } from '@playwright/test';
import { env } from './env.js';

interface MailpitSummary {
  ID: string;
  Subject: string;
}

export interface Email {
  subject: string;
  text: string;
  html: string;
}

/**
 * The shop's outbox as a customer sees it: every email the notification service sends locally
 * lands in Mailpit (http://localhost:8025), whose API we read.
 */
export class Mailbox {
  constructor(
    private readonly request: APIRequestContext,
    readonly address: string,
  ) {}

  /** Waits for an email to this address whose subject matches, and returns it. */
  async waitFor(subject: RegExp, timeout = 45_000): Promise<Email> {
    let found: MailpitSummary | undefined;
    await expect
      .poll(
        async () => {
          const response = await this.request.get(`${env.mailUrl}/api/v1/search`, {
            params: { query: `to:"${this.address}"`, limit: '50' },
          });
          const body = (await response.json()) as { messages: MailpitSummary[] };
          found = body.messages.find((message) => subject.test(message.Subject));
          return found?.Subject;
        },
        {
          timeout,
          intervals: [500, 1_000, 2_000],
          message: `email to ${this.address}: ${subject}`,
        },
      )
      .toMatch(subject);
    const message = await this.request.get(`${env.mailUrl}/api/v1/message/${found?.ID ?? ''}`);
    const body = (await message.json()) as { Subject: string; Text: string; HTML: string };
    return { subject: body.Subject, text: body.Text, html: body.HTML };
  }

  /** The first link in an email that points at `path` on the storefront. */
  static link(email: Email, path: string): string {
    const pattern = new RegExp(`https?://[^\\s"'<>]+${path.replace(/[/]/g, '\\/')}[^\\s"'<>]*`);
    const match = pattern.exec(email.text) ?? pattern.exec(email.html);
    if (!match) throw new Error(`no ${path} link in "${email.subject}"`);
    return match[0].replaceAll('&amp;', '&');
  }
}
