import { Agent, interceptors, type Dispatcher } from 'undici';

export interface InternalDispatcherOptions {
  /** Time to open a connection, name lookup included. */
  connectTimeoutMs?: number;
  connections?: number;
  keepAliveTimeoutMs?: number;
}

/**
 * Connection pool for calls between our own services (gateway → service, service → service).
 *
 * Names are looked up for IPv4 only and cached. Alpine's resolver otherwise asks for A and
 * AAAA at the same time from one socket, and the kernel's connection tracking now and then
 * drops one of the two answers (the race behind Kubernetes' "5 second DNS delay"): the lookup
 * then waits out the resolver timeout (2 s in Docker), longer than the connect timeout, and a
 * healthy service reads as unavailable. Every network the services run on (Docker Compose,
 * the VM, the EKS cluster) is IPv4.
 */
export function createInternalDispatcher(options: InternalDispatcherOptions = {}): Dispatcher {
  return new Agent({
    keepAliveTimeout: options.keepAliveTimeoutMs ?? 10_000,
    connections: options.connections ?? 128,
    connect: { timeout: options.connectTimeoutMs ?? 2_000 },
  }).compose(interceptors.dns({ dualStack: false, affinity: 4 }));
}
