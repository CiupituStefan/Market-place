'use client';

import { RoleSchema } from '@market/types';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from './browser';
import { ApiError } from './errors';

export const SessionUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  firstName: z.string(),
  lastName: z.string(),
  roles: z.array(RoleSchema),
  emailVerified: z.boolean(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

/**
 * Current user from the auth cookie. `null` means signed out (401). The cookie
 * itself is httpOnly; the browser never sees the token.
 */
export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async (): Promise<SessionUser | null> => {
      try {
        return await api('/auth/me', { schema: SessionUserSchema });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
}
