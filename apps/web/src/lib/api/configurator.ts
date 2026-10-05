import { z } from 'zod';
import { ConfigurationQuoteSchema, type ConfigurationSelection } from '@/lib/catalog/schemas';
import { api } from './browser';

export function quoteConfiguration(slug: string, selection: ConfigurationSelection) {
  return api(`/configurator/${encodeURIComponent(slug)}/quote`, {
    method: 'POST',
    body: { selection },
    schema: ConfigurationQuoteSchema,
  });
}

/** The cart re-quotes the configuration server-side; only the selection is sent. */
export function addConfigurationToCart(slug: string, selection: ConfigurationSelection) {
  return api('/cart/configurations', {
    method: 'POST',
    body: { configurator: slug, selection, quantity: 1 },
    schema: z.unknown(),
  });
}
