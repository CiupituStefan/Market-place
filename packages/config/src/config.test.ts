import { describe, expect, it } from 'vitest';
import { baseServiceEnv, ConfigError, kafkaEnv, loadEnv, postgresEnv, SERVICES } from './index.js';

const schema = baseServiceEnv.extend(postgresEnv.shape).extend(kafkaEnv.shape);

describe('loadEnv', () => {
  it('parses and applies defaults', () => {
    const config = loadEnv(schema, {
      PORT: '4002',
      DATABASE_URL: 'postgresql://app:secret@localhost:5432/products',
      KAFKA_BROKERS: 'localhost:9092, kafka-2:9092',
      KAFKA_CLIENT_ID: 'product-service',
      KAFKA_SSL: 'false',
    });
    expect(config).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4002,
      LOG_LEVEL: 'info',
      DATABASE_POOL_MAX: 10,
      KAFKA_BROKERS: ['localhost:9092', 'kafka-2:9092'],
      KAFKA_SSL: false,
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('treats empty strings as unset', () => {
    const config = loadEnv(baseServiceEnv, { PORT: '4000', LOG_LEVEL: '' });
    expect(config.LOG_LEVEL).toBe('info');
  });

  it('reports every problem at once without leaking values', () => {
    const secret = 'mysql://root:SuperSecret@db/x';
    try {
      loadEnv(schema, { PORT: 'abc', DATABASE_URL: secret });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as ConfigError;
      const paths = configError.issues.map((issue) => issue.split(':')[0]);
      expect(paths).toEqual(
        expect.arrayContaining(['PORT', 'DATABASE_URL', 'KAFKA_BROKERS', 'KAFKA_CLIENT_ID']),
      );
      expect(configError.message).not.toContain('SuperSecret');
    }
  });

  it('parses boolean strings strictly', () => {
    expect(
      loadEnv(kafkaEnv, { KAFKA_BROKERS: 'k:9092', KAFKA_CLIENT_ID: 'x', KAFKA_SSL: 'true' })
        .KAFKA_SSL,
    ).toBe(true);
    expect(() =>
      loadEnv(kafkaEnv, { KAFKA_BROKERS: 'k:9092', KAFKA_CLIENT_ID: 'x', KAFKA_SSL: 'yes' }),
    ).toThrow(ConfigError);
  });
});

describe('SERVICES', () => {
  it('assigns a unique port to every deployable', () => {
    const ports = Object.values(SERVICES).map((s) => s.port);
    expect(new Set(ports).size).toBe(ports.length);
  });
});
