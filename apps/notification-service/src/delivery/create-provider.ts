import type { Logger } from '@market/logger';
import type { AppConfig } from '../config.js';
import { LogEmailProvider } from './log.provider.js';
import type { EmailProvider } from './provider.js';
import { SesEmailProvider } from './ses.provider.js';
import { SmtpEmailProvider } from './smtp.provider.js';

export function createEmailProvider(
  config: AppConfig,
  logger: Logger,
): EmailProvider & { close?: () => void } {
  switch (config.EMAIL_PROVIDER) {
    case 'ses':
      // Presence is guaranteed by the config schema.
      return new SesEmailProvider(config.SES_REGION ?? '', config.SES_CONFIGURATION_SET);
    case 'smtp':
      return new SmtpEmailProvider(config.SMTP_URL ?? '');
    case 'log':
      return new LogEmailProvider(logger);
  }
}
