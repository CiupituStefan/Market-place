import { deadLetterTopic, Topics, type Topic } from './topics.js';

/**
 * Who may do what on Kafka. The single source for the per-service ACLs and for the topics the
 * cluster has (rendered to infrastructure/kafka/ by `pnpm --filter @market/events acls`), and
 * checked at startup: a service whose outbox or consumers use a topic not listed here refuses
 * to start, instead of failing on an authorization error in production.
 *
 * Each service's Kafka user (its SCRAM user name is the service name) may:
 * - write and describe the topics it `publishes`;
 * - read and describe the topics it `consumes`, and write their dead-letter topics;
 * - use consumer groups named `<service>.<anything>` (and no other).
 * Nothing else: no topic creation, no other topics or groups, no cluster operations. A service
 * missing from the list (api-gateway) has no Kafka access at all.
 */
export interface KafkaAccess {
  readonly publishes: readonly Topic[];
  readonly consumes: readonly Topic[];
}

export const kafkaAccess: Readonly<Record<string, KafkaAccess>> = {
  'auth-service': { publishes: [Topics.NOTIFICATION], consumes: [] },
  'product-service': { publishes: [Topics.PRODUCT], consumes: [Topics.INVENTORY, Topics.REVIEW] },
  'inventory-service': { publishes: [Topics.INVENTORY], consumes: [Topics.PRODUCT] },
  'cart-service': { publishes: [], consumes: [Topics.ORDER] },
  'order-service': { publishes: [Topics.ORDER], consumes: [] },
  'payment-service': { publishes: [Topics.PAYMENT], consumes: [Topics.ORDER] },
  'notification-service': {
    publishes: [],
    consumes: [Topics.NOTIFICATION, Topics.ORDER, Topics.PAYMENT],
  },
  'review-service': { publishes: [Topics.REVIEW], consumes: [Topics.ORDER] },
  'admin-service': { publishes: [], consumes: [Topics.ORDER, Topics.PAYMENT] },
};

/** The consumer groups a service may use: its name, a dot, then anything. */
export function consumerGroupPrefix(service: string): string {
  return `${service}.`;
}

/**
 * What `service` asks for that its access does not grant (empty: all allowed). Used at
 * startup by @market/messaging.
 */
export function kafkaAccessViolations(
  service: string,
  wanted: {
    publishes: readonly Topic[];
    consumers: readonly { name: string; topics: readonly Topic[] }[];
  },
  access: Readonly<Record<string, KafkaAccess>> = kafkaAccess,
): string[] {
  const granted = access[service];
  if (!granted) {
    return wanted.publishes.length + wanted.consumers.length > 0
      ? [`${service} has no Kafka access (packages/events/src/access.ts)`]
      : [];
  }
  const violations: string[] = [];
  for (const topic of wanted.publishes) {
    if (!granted.publishes.includes(topic)) violations.push(`publish to ${topic}`);
  }
  for (const consumer of wanted.consumers) {
    if (!consumer.name.startsWith(consumerGroupPrefix(service))) {
      violations.push(
        `consumer group ${consumer.name} (must start with ${consumerGroupPrefix(service)})`,
      );
    }
    for (const topic of consumer.topics) {
      if (!granted.consumes.includes(topic)) violations.push(`consume ${topic}`);
    }
  }
  return violations;
}

/** One Kafka ACL: allow `principal` the `operation` on a resource. */
export interface KafkaAcl {
  principal: string;
  resourceType: 'TOPIC' | 'GROUP';
  patternType: 'LITERAL' | 'PREFIXED';
  resourceName: string;
  operation: 'READ' | 'WRITE' | 'DESCRIBE';
}

/** Every ACL the access list implies, sorted, without duplicates. */
export function kafkaAcls(access: Readonly<Record<string, KafkaAccess>> = kafkaAccess): KafkaAcl[] {
  const acls = new Map<string, KafkaAcl>();
  const add = (acl: KafkaAcl) => acls.set(aclLine(acl), acl);
  const topic = (principal: string, name: string, operation: KafkaAcl['operation']) =>
    add({
      principal,
      resourceType: 'TOPIC',
      patternType: 'LITERAL',
      resourceName: name,
      operation,
    });

  for (const [service, granted] of Object.entries(access)) {
    const principal = `User:${service}`;
    for (const name of granted.publishes) {
      topic(principal, name, 'WRITE');
      topic(principal, name, 'DESCRIBE');
    }
    for (const name of granted.consumes) {
      topic(principal, name, 'READ');
      topic(principal, name, 'DESCRIBE');
      // Events that keep failing are moved to the dead-letter topic by the consumer.
      topic(principal, deadLetterTopic(name), 'WRITE');
      topic(principal, deadLetterTopic(name), 'DESCRIBE');
    }
    if (granted.consumes.length > 0) {
      add({
        principal,
        resourceType: 'GROUP',
        patternType: 'PREFIXED',
        resourceName: consumerGroupPrefix(service),
        operation: 'READ',
      });
    }
  }
  return [...acls.values()].sort((a, b) => aclLine(a).localeCompare(aclLine(b)));
}

/** `principal resourceType patternType name operation`: the line format of acls.txt. */
export function aclLine(acl: KafkaAcl): string {
  return [acl.principal, acl.resourceType, acl.patternType, acl.resourceName, acl.operation].join(
    ' ',
  );
}

/** Every topic the cluster has: each domain topic and its dead-letter topic. */
export function kafkaTopics(): string[] {
  return Object.values(Topics)
    .flatMap((name) => [name, deadLetterTopic(name)])
    .sort();
}
