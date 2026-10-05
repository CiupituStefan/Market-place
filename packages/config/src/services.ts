/**
 * Canonical list of deployable units and their default ports. Docker Compose,
 * Helm values and the API gateway's upstream map are kept consistent with this.
 */
export const SERVICES = {
  web: { port: 3000 },
  'api-gateway': { port: 4000 },
  'auth-service': { port: 4001 },
  'product-service': { port: 4002 },
  'inventory-service': { port: 4003 },
  'cart-service': { port: 4004 },
  'order-service': { port: 4005 },
  'payment-service': { port: 4006 },
  'notification-service': { port: 4007 },
  'review-service': { port: 4008 },
  'admin-service': { port: 4009 },
} as const;

export type ServiceName = keyof typeof SERVICES;
