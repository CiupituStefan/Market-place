import nodemailer, { type Transporter } from 'nodemailer';
import { PermanentDeliveryError, type EmailProvider, type OutgoingEmail } from './provider.js';

/** Any SMTP server: Mailpit in local Docker Compose, or a relay. */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly transport: Transporter;

  constructor(url: string) {
    this.transport = nodemailer.createTransport(url);
  }

  async send(email: OutgoingEmail): Promise<{ messageId: string }> {
    try {
      const info = (await this.transport.sendMail({
        from: email.from,
        to: email.to,
        replyTo: email.replyTo,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: email.headers,
      })) as { messageId: string };
      return { messageId: info.messageId };
    } catch (error) {
      // 5xx replies (unknown mailbox, rejected content) will not succeed on retry.
      const code = (error as { responseCode?: number }).responseCode;
      if (code !== undefined && code >= 500 && code < 600) {
        throw new PermanentDeliveryError((error as Error).message);
      }
      throw error;
    }
  }

  close(): void {
    this.transport.close();
  }
}
