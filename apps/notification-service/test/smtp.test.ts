import type { AddressInfo } from 'node:net';
import { SMTPServer } from 'smtp-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PermanentDeliveryError } from '../src/delivery/provider.js';
import { SmtpEmailProvider } from '../src/delivery/smtp.provider.js';

/** The SMTP provider against a real (in-process) SMTP server, as with Mailpit locally. */
describe('SMTP provider', () => {
  const received: { to: string[]; raw: string }[] = [];
  let server: SMTPServer;
  let provider: SmtpEmailProvider;

  beforeAll(async () => {
    server = new SMTPServer({
      authOptional: true,
      disabledCommands: ['STARTTLS'],
      onRcptTo(address, _session, callback) {
        if (address.address.endsWith('@nowhere.test')) {
          const error = Object.assign(new Error('Mailbox unavailable'), { responseCode: 550 });
          callback(error);
          return;
        }
        callback();
      },
      onData(stream, session, callback) {
        let raw = '';
        stream.on('data', (chunk: Buffer) => (raw += chunk.toString()));
        stream.on('end', () => {
          received.push({ to: session.envelope.rcptTo.map((r) => r.address), raw });
          callback();
        });
      },
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.server.address() as AddressInfo;
    provider = new SmtpEmailProvider(`smtp://127.0.0.1:${String(port)}`);
  });

  afterAll(async () => {
    provider.close();
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  const email = (to: string) => ({
    to,
    from: 'CSE Keyboards <hello@csekeyboards.test>',
    subject: 'Order CSE-1 confirmed',
    html: '<p>Hello</p>',
    text: 'Hello',
    headers: { 'List-Unsubscribe': '<https://api.shop.test/u?token=t>' },
  });

  it('delivers HTML + text with custom headers', async () => {
    const { messageId } = await provider.send(email('ana@example.com'));
    expect(messageId).toMatch(/@/);
    expect(received[0]?.to).toEqual(['ana@example.com']);
    expect(received[0]?.raw).toContain('Subject: Order CSE-1 confirmed');
    expect(received[0]?.raw).toContain('List-Unsubscribe: <https://api.shop.test/u?token=t>');
    expect(received[0]?.raw).toContain('multipart/alternative');
  });

  it('maps 5xx rejections to a permanent failure', async () => {
    await expect(provider.send(email('ghost@nowhere.test'))).rejects.toBeInstanceOf(
      PermanentDeliveryError,
    );
  });
});
