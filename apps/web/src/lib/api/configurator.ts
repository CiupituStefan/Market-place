import { ConfigurationQuoteSchema, type ConfigurationSelection } from '@/lib/catalog/schemas';
import { api } from './browser';

export function quoteConfiguration(slug: string, selection: ConfigurationSelection) {
  return api(`/configurator/${encodeURIComponent(slug)}/quote`, {
    method: 'POST',
    body: { selection },
    schema: ConfigurationQuoteSchema,
  });
}
