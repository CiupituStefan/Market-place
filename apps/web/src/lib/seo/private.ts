import type { Metadata } from 'next';

/** Metadata for personal / transactional pages that must never be indexed. */
export function privatePage(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}
