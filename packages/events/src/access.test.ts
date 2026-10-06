import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { aclLine, kafkaAccessViolations, kafkaAcls, kafkaTopics } from './access.js';
import { Topics } from './topics.js';

const generated = (name: string) =>
  fileURLToPath(new URL(`../../../infrastructure/kafka/${name}`, import.meta.url));

const header = (what: string) =>
  `# ${what}\n# Generated from packages/events/src/access.ts by \`pnpm --filter @market/events acls\`; do not edit.\n`;

describe('kafka access', () => {
  const lines = kafkaAcls().map(aclLine);

  it('lets a service write only the topics it owns', () => {
    expect(lines).toContain('User:order-service TOPIC LITERAL orders.order.events WRITE');
    expect(lines).not.toContain('User:order-service TOPIC LITERAL payments.payment.events WRITE');
    expect(lines.filter((l) => l.startsWith('User:order-service ') && l.endsWith(' READ'))).toEqual(
      [],
    );
  });

  it('lets a consumer read its topics, dead-letter them and use only its own groups', () => {
    expect(lines).toEqual(
      expect.arrayContaining([
        'User:payment-service TOPIC LITERAL orders.order.events READ',
        'User:payment-service TOPIC LITERAL orders.order.events.dlq WRITE',
        'User:payment-service GROUP PREFIXED payment-service. READ',
      ]),
    );
    expect(lines).not.toContain('User:payment-service TOPIC LITERAL orders.order.events WRITE');
  });

  it('gives nothing to services without Kafka, and nothing beyond topics and groups', () => {
    expect(lines.some((l) => l.startsWith('User:api-gateway '))).toBe(false);
    expect(new Set(kafkaAcls().map((a) => a.operation))).toEqual(
      new Set(['READ', 'WRITE', 'DESCRIBE']),
    );
  });

  it('refuses to start a service asking for more than it is granted', () => {
    expect(
      kafkaAccessViolations('payment-service', {
        publishes: [Topics.PAYMENT],
        consumers: [{ name: 'payment-service.orders', topics: [Topics.ORDER] }],
      }),
    ).toEqual([]);
    expect(
      kafkaAccessViolations('cart-service', {
        publishes: [Topics.ORDER],
        consumers: [{ name: 'payment-service.orders', topics: [Topics.PAYMENT] }],
      }),
    ).toEqual([
      'publish to orders.order.events',
      'consumer group payment-service.orders (must start with cart-service.)',
      'consume payments.payment.events',
    ]);
    expect(kafkaAccessViolations('api-gateway', { publishes: [], consumers: [] })).toEqual([]);
    expect(
      kafkaAccessViolations('api-gateway', { publishes: [Topics.ORDER], consumers: [] }),
    ).toHaveLength(1);
  });

  // The cluster's ACLs and topics are applied from these files (Terraform modules/platform).
  it.each([
    [
      'acls.txt',
      header('Kafka ACLs: principal resource-type pattern-type name operation') + lines.join('\n'),
    ],
    ['topics.txt', header('Kafka topics') + kafkaTopics().join('\n')],
  ])('infrastructure/kafka/%s is up to date', (name, content) => {
    const path = generated(name);
    if (process.env.UPDATE_KAFKA_ACCESS === '1') writeFileSync(path, `${content}\n`);
    expect(readFileSync(path, 'utf8'), 'run: pnpm --filter @market/events acls').toBe(
      `${content}\n`,
    );
  });
});
