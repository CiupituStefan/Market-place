/** Liveness/readiness probe for Kubernetes. Never cached. */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { status: 'ok', service: 'web' },
    { headers: { 'cache-control': 'no-store' } },
  );
}
