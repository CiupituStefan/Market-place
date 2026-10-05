import { publicEnv } from '../env';
import { createApiClient } from './client';

/** Client used from Client Components (browser → api-gateway). */
export const api = createApiClient(publicEnv.NEXT_PUBLIC_API_URL);
