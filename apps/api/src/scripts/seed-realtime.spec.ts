import { describe, expect, it } from 'vitest';
import { parseArguments } from './seed-realtime';

describe('parseArguments', () => {
  it('parses portable CLI flags and overrides environment defaults', () => {
    const options = parseArguments(
      [
        '--duration',
        '180',
        '--rps=20',
        '--scenario',
        'bursty',
        '--seed',
        '42',
        '--interval',
        '500',
      ],
      {
        API_URL: 'http://api.example/',
        DASHBOARD_URL: 'http://dashboard.example/',
      },
    );

    expect(options).toMatchObject({
      apiUrl: 'http://api.example',
      dashboardUrl: 'http://dashboard.example',
      durationSeconds: 180,
      requestsPerSecond: 20,
      scenario: 'bursty',
      seed: 42,
      intervalMs: 500,
    });
  });

  it('supports a continuous run with duration zero', () => {
    expect(parseArguments(['--duration', '0'], { SEED: '10' }).durationSeconds).toBe(0);
  });

  it('rejects unknown scenarios', () => {
    expect(() => parseArguments(['--scenario', 'chaos'], {})).toThrow(/Unknown scenario/);
  });

  it('rejects invalid numeric options', () => {
    expect(() => parseArguments(['--rps', '0'], {})).toThrow(/positive number/);
    expect(() => parseArguments(['--interval', '-1'], {})).toThrow(/positive number/);
    expect(() => parseArguments(['--seed', '1.5'], {})).toThrow(/integer/);
  });
});

