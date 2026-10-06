import { z } from 'zod';

/**
 * Zod compiles object validators with `new Function` when it can, and finds out by trying once.
 * Our CSP has no 'unsafe-eval', so in the browser that probe is blocked and reported as a
 * violation on every page. Jitless mode skips the probe and the compiler; validation is the same.
 * Imported for its side effect before any client code parses.
 */
z.config({ jitless: true });
