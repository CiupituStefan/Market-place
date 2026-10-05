import { describe, expect, it } from 'vitest';
import { fieldErrors, RegisterSchema, safeRedirect } from './validation';

describe('safeRedirect', () => {
  it.each([
    ['/account/orders', '/account/orders'],
    [null, '/account'],
    ['https://evil.example', '/account'],
    ['//evil.example', '/account'],
    ['/\\evil.example', '/account'],
    ['javascript:alert(1)', '/account'],
  ])('%s -> %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });
});

describe('RegisterSchema', () => {
  const valid = {
    firstName: 'Ana',
    lastName: 'Pop',
    email: 'ana@example.com',
    password: 'correct horse battery',
    confirmPassword: 'correct horse battery',
    acceptTerms: true,
  };

  it('accepts a valid registration', () => {
    expect(RegisterSchema.safeParse(valid).success).toBe(true);
  });

  it('reports field errors', () => {
    const result = RegisterSchema.safeParse({
      ...valid,
      password: 'short',
      confirmPassword: 'other',
      acceptTerms: false,
    });
    expect(result.success).toBe(false);
    const errors = fieldErrors(result.error!);
    expect(errors.password).toMatch(/at least 12/);
    expect(errors.acceptTerms).toBeDefined();
  });

  it('rejects mismatched passwords', () => {
    const result = RegisterSchema.safeParse({ ...valid, confirmPassword: 'different passphrase' });
    expect(fieldErrors(result.error!).confirmPassword).toBe('Passwords do not match.');
  });
});
