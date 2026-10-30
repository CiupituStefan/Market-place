import type { TopicSlug } from './types';

/**
 * The guide topics that help choose from a shop category (only where the guide covers it):
 * keyboards by size and build, switches, keycaps.
 */
export const CATEGORY_GUIDES: Readonly<Record<string, readonly TopicSlug[]>> = {
  keyboards: ['layouts', 'mounting'],
  switches: ['switches'],
  keycaps: ['keycaps'],
};
