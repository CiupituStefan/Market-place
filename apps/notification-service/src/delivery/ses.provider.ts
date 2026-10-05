import {
  AccountSuspendedException,
  BadRequestException,
  MailFromDomainNotVerifiedException,
  MessageRejected,
  SendEmailCommand,
  SESv2Client,
} from '@aws-sdk/client-sesv2';
import { PermanentDeliveryError, type EmailProvider, type OutgoingEmail } from './provider.js';

/**
 * Amazon SES (v2 API). Credentials come from the default provider chain: the
 * pod's IAM role (IRSA) in EKS, never static keys. Bounces and complaints are
 * handled by SES's account-level suppression list.
 */
export class SesEmailProvider implements EmailProvider {
  readonly name = 'ses';
  private readonly client: SESv2Client;

  constructor(
    region: string,
    private readonly configurationSet?: string,
  ) {
    this.client = new SESv2Client({ region });
  }

  async send(email: OutgoingEmail): Promise<{ messageId: string }> {
    try {
      const result = await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: email.from,
          Destination: { ToAddresses: [email.to] },
          ReplyToAddresses: email.replyTo ? [email.replyTo] : undefined,
          ConfigurationSetName: this.configurationSet,
          Content: {
            Simple: {
              Subject: { Data: email.subject, Charset: 'UTF-8' },
              Body: {
                Html: { Data: email.html, Charset: 'UTF-8' },
                Text: { Data: email.text, Charset: 'UTF-8' },
              },
              Headers: Object.entries(email.headers).map(([Name, Value]) => ({ Name, Value })),
            },
          },
        }),
      );
      return { messageId: result.MessageId ?? 'unknown' };
    } catch (error) {
      if (
        error instanceof MessageRejected ||
        error instanceof BadRequestException ||
        error instanceof MailFromDomainNotVerifiedException ||
        error instanceof AccountSuspendedException
      ) {
        throw new PermanentDeliveryError(error.message);
      }
      // Throttling, 5xx, network: retried with backoff.
      throw error;
    }
  }

  close(): void {
    this.client.destroy();
  }
}
