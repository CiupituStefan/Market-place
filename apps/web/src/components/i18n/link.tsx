'use client';

import NextLink from 'next/link';
import type { ComponentProps } from 'react';
import { useI18n } from './provider';

/**
 * next/link that stays in the current language: `/shop` points at `/ro/shop` on Romanian pages.
 * Storefront code imports this instead of next/link; external and back-office links pass
 * through unchanged.
 */
export default function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const { path } = useI18n();
  const localized =
    typeof href === 'string'
      ? path(href)
      : { ...href, ...(href.pathname ? { pathname: path(href.pathname) } : {}) };
  return <NextLink href={localized} {...props} />;
}
