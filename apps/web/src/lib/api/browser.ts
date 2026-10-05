import { publicEnv } from '../env';
import { buildUrl, createApiClient } from './client';

let refreshing: Promise<boolean> | null = null;

/**
 * Renews the session with the refresh cookie. Concurrent 401s share one refresh
 * call, so a page firing several requests rotates the refresh token only once.
 */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(buildUrl(publicEnv.NEXT_PUBLIC_API_URL, '/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: { accept: 'application/json' },
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Client used from Client Components (browser → api-gateway). */
export const api = createApiClient(publicEnv.NEXT_PUBLIC_API_URL, {
  // Auth endpoints answer 401 for wrong credentials; never try to refresh those.
  onUnauthorized: (path) => (path.startsWith('/auth/') ? Promise.resolve(false) : refreshSession()),
});
