import { z } from 'zod';
import { RoleSchema } from './roles.js';

/**
 * Session cookies. The access token is sent on every API call (Path=/); the
 * refresh token only to the auth endpoints that need it (narrow Path, SameSite=Strict).
 * Both are httpOnly: JavaScript never sees a token.
 */
export const ACCESS_TOKEN_COOKIE = 'cse_at';
export const REFRESH_TOKEN_COOKIE = 'cse_rt';
export const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth';

export const JWT_AUDIENCE = 'cse-api';

/** Claims carried by access tokens issued by auth-service (EdDSA-signed JWTs). */
export const AccessTokenClaimsSchema = z.object({
  sub: z.uuid(),
  /** Session id: lets services check revocation when an operation is sensitive. */
  sid: z.uuid(),
  roles: z.array(RoleSchema).min(1),
  email_verified: z.boolean(),
  /** Account email (added in Phase 11; optional so tokens issued before still verify). */
  email: z.email().optional(),
});
export type AccessTokenClaims = z.infer<typeof AccessTokenClaimsSchema>;

/** The authenticated principal as services see it. */
export interface AuthUser {
  id: string;
  sessionId: string;
  roles: z.infer<typeof RoleSchema>[];
  emailVerified: boolean;
  email?: string | undefined;
}
