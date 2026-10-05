import { ConfigurationQuoteSchema, ConfiguratorSchema } from '@market/types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './harness.js';

let h: Harness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.close();
});

const quote = (selection: Record<string, string>) =>
  request(h.http).post('/api/v1/configurator/cse-custom/quote').send({ selection });

const defaults = {
  layout: '75',
  case: 'black',
  switch: 'linear',
  plate: 'aluminum',
  keycaps: 'pbt',
  connection: 'wired',
};

describe('configurator', () => {
  it('describes groups, options, rules and a default selection', async () => {
    const res = await request(h.http).get('/api/v1/configurator/cse-custom').expect(200);
    const configurator = ConfiguratorSchema.parse(res.body);
    expect(configurator.groups.map((g) => g.key)).toEqual([
      'layout',
      'case',
      'switch',
      'plate',
      'keycaps',
      'connection',
    ]);
    expect(configurator.defaultSelection).toEqual(defaults);
    expect(configurator.incompatibilities).toHaveLength(2);
  });

  it('prices a selection on the server, with a breakdown that sums up', async () => {
    const res = await quote({ ...defaults, case: 'silver', connection: 'bluetooth' }).expect(200);
    const result = ConfigurationQuoteSchema.parse(res.body);
    // 129 base + 20 (75%) + 15 (silver) + 10 (PBT) + 20 (Bluetooth)
    expect(result.price).toEqual({ amount: 194_00, currency: 'EUR' });
    expect(result.breakdown.reduce((sum, line) => sum + line.amount.amount, 0)).toBe(
      result.price.amount,
    );
    expect(result.sku).toBe('CSE-CFG-75-SLV-LIN-ALU-PBT-BT');
    expect(result.preview).toMatchObject({
      layout: '75%',
      caseColor: '#b8bbc0',
      keyColor: '#f6f3ec',
    });
  });

  it('gives the same configuration the same id regardless of key order', async () => {
    const a = (await quote(defaults).expect(200)).body.configurationId;
    const reversed = Object.fromEntries(Object.entries(defaults).reverse());
    const b = (await quote(reversed).expect(200)).body.configurationId;
    const c = (await quote({ ...defaults, switch: 'tactile' }).expect(200)).body.configurationId;
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });

  it('rejects incompatible combinations with the reason', async () => {
    const res = await quote({ ...defaults, layout: '100', connection: '2-4ghz' }).expect(422);
    expect(res.body.error.code).toBe('INVALID_CONFIGURATION');
    expect(res.body.error.details[0]).toMatchObject({ path: 'layout+connection' });
  });

  it('reports missing and unknown choices', async () => {
    const { layout: _layout, ...missing } = defaults;
    const res = await quote({ ...missing, case: 'gold' }).expect(422);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { path: 'layout', message: 'Choose a layout' },
        { path: 'case', message: 'Unknown option "gold"' },
      ]),
    );
    await request(h.http)
      .post('/api/v1/configurator/cse-custom/quote')
      .send({ selection: { gpu: 'x' } })
      .expect(400);
  });

  it('404s unknown configurators', async () => {
    await request(h.http).get('/api/v1/configurator/nope').expect(404);
  });
});
