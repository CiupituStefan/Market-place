import { describe, expect, it } from 'vitest';
import { onlyAlreadyExists } from '../src/kafka.js';

const exists = { apiId: 'TOPIC_ALREADY_EXISTS' };

describe('onlyAlreadyExists', () => {
  it('accepts nested "topic already exists" errors (another service created it first)', () => {
    expect(onlyAlreadyExists({ errors: [{ errors: [exists, exists] }] })).toBe(true);
  });

  it('rejects anything else, alone or mixed in', () => {
    expect(
      onlyAlreadyExists({
        errors: [{ errors: [exists, { apiId: 'INVALID_REPLICATION_FACTOR' }] }],
      }),
    ).toBe(false);
    expect(onlyAlreadyExists(new Error('connection refused'))).toBe(false);
    expect(onlyAlreadyExists({ errors: [] })).toBe(false);
  });
});
