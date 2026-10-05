import { hash, verify } from '@node-rs/argon2';

/** `Algorithm.Argon2id` (a const enum, which isolated modules cannot import). */
const ARGON2ID = 2;

/**
 * Argon2id with OWASP-recommended parameters (19 MiB memory, 2 iterations).
 * Bumping them later is safe: old hashes are upgraded on the next sign-in.
 */
const PARAMS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;
const PARAMS_MARKER = `m=${PARAMS.memoryCost},t=${PARAMS.timeCost},p=${PARAMS.parallelism}`;

export function hashPassword(password: string): Promise<string> {
  return hash(password, PARAMS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export function needsRehash(passwordHash: string): boolean {
  return !passwordHash.startsWith('$argon2id$') || !passwordHash.includes(PARAMS_MARKER);
}

let dummyHash: Promise<string> | undefined;

/**
 * Verifies against a throwaway hash so "unknown email" takes as long as "wrong
 * password": response timing must not reveal which accounts exist.
 */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('dummy-password-for-timing-equalisation');
  await verifyPassword(await dummyHash, password);
}
