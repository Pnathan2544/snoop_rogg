export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface EndpointProfile {
  path: string;
  method: HttpMethod;
  weight: number;
  medianLatencyMs: number;
  latencySigma: number;
}

export interface ProviderProfile {
  name: string;
  weight: number;
  requestsPerMinuteQuota: number;
  baseErrorRate: number;
  baseRateLimitRate: number;
  endpoints: readonly EndpointProfile[];
}

export const PROVIDER_PROFILES: readonly ProviderProfile[] = [
  {
    name: 'openai',
    weight: 38,
    requestsPerMinuteQuota: 420,
    baseErrorRate: 0.012,
    baseRateLimitRate: 0.002,
    endpoints: [
      {
        path: '/v1/chat/completions',
        method: 'POST',
        weight: 52,
        medianLatencyMs: 720,
        latencySigma: 0.48,
      },
      {
        path: '/v1/embeddings',
        method: 'POST',
        weight: 30,
        medianLatencyMs: 180,
        latencySigma: 0.35,
      },
      {
        path: '/v1/images/generations',
        method: 'POST',
        weight: 18,
        medianLatencyMs: 2400,
        latencySigma: 0.42,
      },
    ],
  },
  {
    name: 'anthropic',
    weight: 22,
    requestsPerMinuteQuota: 260,
    baseErrorRate: 0.014,
    baseRateLimitRate: 0.002,
    endpoints: [
      {
        path: '/v1/messages',
        method: 'POST',
        weight: 88,
        medianLatencyMs: 840,
        latencySigma: 0.5,
      },
      {
        path: '/v1/messages/count_tokens',
        method: 'POST',
        weight: 12,
        medianLatencyMs: 110,
        latencySigma: 0.3,
      },
    ],
  },
  {
    name: 'stripe',
    weight: 16,
    requestsPerMinuteQuota: 500,
    baseErrorRate: 0.008,
    baseRateLimitRate: 0.001,
    endpoints: [
      {
        path: '/v1/charges',
        method: 'POST',
        weight: 42,
        medianLatencyMs: 260,
        latencySigma: 0.36,
      },
      {
        path: '/v1/customers/:id',
        method: 'GET',
        weight: 33,
        medianLatencyMs: 120,
        latencySigma: 0.3,
      },
      {
        path: '/v1/payment_intents/:id',
        method: 'POST',
        weight: 25,
        medianLatencyMs: 310,
        latencySigma: 0.38,
      },
    ],
  },
  {
    name: 'github',
    weight: 14,
    requestsPerMinuteQuota: 220,
    baseErrorRate: 0.01,
    baseRateLimitRate: 0.002,
    endpoints: [
      {
        path: '/repos/:id/commits',
        method: 'GET',
        weight: 52,
        medianLatencyMs: 190,
        latencySigma: 0.4,
      },
      {
        path: '/repos/:id/issues',
        method: 'GET',
        weight: 30,
        medianLatencyMs: 170,
        latencySigma: 0.38,
      },
      {
        path: '/repos/:id/pulls',
        method: 'POST',
        weight: 18,
        medianLatencyMs: 330,
        latencySigma: 0.42,
      },
    ],
  },
  {
    name: 'sendgrid',
    weight: 10,
    requestsPerMinuteQuota: 200,
    baseErrorRate: 0.011,
    baseRateLimitRate: 0.002,
    endpoints: [
      {
        path: '/v3/mail/send',
        method: 'POST',
        weight: 82,
        medianLatencyMs: 290,
        latencySigma: 0.4,
      },
      {
        path: '/v3/suppression/bounces',
        method: 'GET',
        weight: 18,
        medianLatencyMs: 140,
        latencySigma: 0.34,
      },
    ],
  },
] as const;

