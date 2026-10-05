export interface HealthCheck {
  name: string;
  /** Resolves when healthy, rejects (or times out) when not. */
  check: () => Promise<void>;
  /**
   * Critical checks fail readiness (the pod stops receiving traffic). Non-critical
   * ones are reported only — e.g. a cache the service can degrade without.
   */
  critical?: boolean;
}

export const HEALTH_CHECKS = Symbol('HEALTH_CHECKS');
export const HEALTH_SERVICE_NAME = Symbol('HEALTH_SERVICE_NAME');

export type CheckStatus = 'up' | 'down';

export interface ReadinessReport {
  status: 'ok' | 'error';
  service: string;
  checks: Record<string, CheckStatus>;
}
