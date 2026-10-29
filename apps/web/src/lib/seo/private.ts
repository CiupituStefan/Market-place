import type { Metadata } from 'next';
import type { Messages } from '@/lib/i18n/messages';
import { getI18n } from '@/lib/i18n/server';

/** Metadata for personal / transactional pages that must never be indexed. */
export function privatePage(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}

/** The same, titled in the page's language: `export const generateMetadata = localPrivatePage(...)`. */
export function localPrivatePage(title: (t: Messages) => string): () => Promise<Metadata> {
  return async () => privatePage(title((await getI18n()).t));
}
