import { describe, expect, it } from 'vitest';
import {
  ALL_EVENTS,
  createEvent,
  deadLetterTopic,
  isEvent,
  OrderPaidV1,
  parseEvent,
  PaymentSucceededV1,
  Topics,
  UnknownEventError,
} from './index.js';

const ORDER_ID = '0b7c1f0e-4f2a-4d8e-9a43-3c1f6f1c9a10';
const PAYMENT_ID = '5a2d8c3e-1b4f-4e6a-8c7d-2f9e0a1b3c4d';

const succeededPayload = {
  paymentId: PAYMENT_ID,
  orderId: ORDER_ID,
  stripePaymentIntentId: 'pi_123',
  amount: { amount: 15999, currency: 'EUR' as const },
  stripeEventId: 'evt_123',
  succeededAt: '2026-10-05T10:00:00.000Z',
};

describe('event contracts', () => {
  it('registers every event required by the checkout and catalog flows', () => {
    const names = ALL_EVENTS.map((e) => `${e.type}@v${e.version}`).sort();
    expect(names).toEqual(
      [
        'InventoryDecremented@v1',
        'InventoryReleased@v1',
        'InventoryReservationExpired@v1',
        'InventoryReserved@v1',
        'NotificationRequested@v1',
        'OrderCancelled@v1',
        'OrderCreated@v1',
        'OrderDelivered@v1',
        'OrderPaid@v1',
        'OrderShipped@v1',
        'PaymentCreated@v1',
        'PaymentFailed@v1',
        'PaymentRefunded@v1',
        'PaymentSucceeded@v1',
        'ProductCreated@v1',
        'ProductUpdated@v1',
        'ReviewCreated@v1',
      ].sort(),
    );
  });

  it('has no duplicate type/version pairs', () => {
    const keys = ALL_EVENTS.map((e) => `${e.type}@v${e.version}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('creates an envelope with metadata', () => {
    const event = createEvent(PaymentSucceededV1, succeededPayload, {
      producer: 'payment-service',
      aggregateId: PAYMENT_ID,
      correlationId: 'req-abc',
      occurredAt: new Date('2026-10-05T10:00:01.000Z'),
    });
    expect(event).toMatchObject({
      eventType: 'PaymentSucceeded',
      eventVersion: 1,
      producer: 'payment-service',
      aggregateId: PAYMENT_ID,
      correlationId: 'req-abc',
      causationId: null,
      occurredAt: '2026-10-05T10:00:01.000Z',
    });
    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('refuses to create an event with an invalid payload', () => {
    expect(() =>
      createEvent(
        PaymentSucceededV1,
        { ...succeededPayload, amount: { amount: 12.5, currency: 'EUR' } },
        { producer: 'payment-service', aggregateId: PAYMENT_ID, correlationId: 'req' },
      ),
    ).toThrow();
  });

  it('round-trips through JSON serialisation', () => {
    const event = createEvent(PaymentSucceededV1, succeededPayload, {
      producer: 'payment-service',
      aggregateId: PAYMENT_ID,
      correlationId: 'req-abc',
    });
    const parsed = parseEvent(Buffer.from(JSON.stringify(event)));
    expect(parsed).toEqual(event);
    expect(isEvent(parsed, PaymentSucceededV1)).toBe(true);
    expect(isEvent(parsed, OrderPaidV1)).toBe(false);
  });

  it('rejects unknown versions so they can be dead-lettered', () => {
    const event = createEvent(PaymentSucceededV1, succeededPayload, {
      producer: 'payment-service',
      aggregateId: PAYMENT_ID,
      correlationId: 'req-abc',
    });
    expect(() => parseEvent(JSON.stringify({ ...event, eventVersion: 99 }))).toThrow(
      UnknownEventError,
    );
  });

  it('rejects payloads that violate the contract on the consumer side', () => {
    const event = createEvent(PaymentSucceededV1, succeededPayload, {
      producer: 'payment-service',
      aggregateId: PAYMENT_ID,
      correlationId: 'req-abc',
    });
    const tampered = { ...event, payload: { ...event.payload, stripePaymentIntentId: 'nope' } };
    expect(() => parseEvent(JSON.stringify(tampered))).toThrow();
  });

  it('derives dead-letter topic names', () => {
    expect(deadLetterTopic(Topics.PAYMENT)).toBe('payments.payment.events.dlq');
  });
});
