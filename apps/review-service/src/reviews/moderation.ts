import type { ReviewStatus } from '@market/types';

const URL_PATTERN =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|ro|de|eu|io|shop|store|xyz|info|biz)\b/i;
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE_PATTERN = /(?:\+?\d[\s().-]?){8,}/;

/**
 * First-line moderation, applied on every create and edit. Reviews with links or
 * contact details (the usual spam and "contact me" patterns) wait for a
 * moderator; everything else is published at once. Moderators can always
 * reject or restore afterwards.
 */
export function autoModerate(text: { title: string; body: string; authorName: string }): {
  status: ReviewStatus;
  note: string | null;
} {
  const all = `${text.authorName}\n${text.title}\n${text.body}`;
  // Emails first: their domain part would otherwise also read as a link.
  if (EMAIL_PATTERN.test(all)) return { status: 'PENDING', note: 'Contains an email address' };
  if (URL_PATTERN.test(all)) return { status: 'PENDING', note: 'Contains a link' };
  if (PHONE_PATTERN.test(all)) return { status: 'PENDING', note: 'Contains a phone number' };
  return { status: 'PUBLISHED', note: null };
}
