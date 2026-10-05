import { describe, expect, it } from 'vitest';
import { autoModerate } from './moderation.js';

const review = (body: string, title = 'Great board', authorName = 'Ana P.') => ({
  title,
  body,
  authorName,
});

describe('autoModerate', () => {
  it('publishes ordinary reviews, including numbers that are not phone numbers', () => {
    expect(
      autoModerate(review('Typing on 65g springs at 75% layout, 3 months in: still love it.'))
        .status,
    ).toBe('PUBLISHED');
  });

  it.each([
    ['https://cheap-switches.example/deal', 'Contains a link'],
    ['visit www.example.org for more', 'Contains a link'],
    ['buy at keebdeals.shop today', 'Contains a link'],
    ['write me at someone@example.com', 'Contains an email address'],
    ['call +40 721 123 456 for a discount', 'Contains a phone number'],
  ])('holds %s for moderation', (body, note) => {
    expect(autoModerate(review(body))).toEqual({ status: 'PENDING', note });
  });

  it('checks the title and author name too', () => {
    expect(autoModerate(review('fine', 'see www.spam.com')).status).toBe('PENDING');
    expect(autoModerate(review('fine', 'ok', 'spam.com')).status).toBe('PENDING');
  });
});
