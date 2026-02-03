import { describe, it, expect } from 'vitest';
import { ThreatLockerClient } from './client.js';

describe('ThreatLockerClient', () => {
  it('throws if API key is missing', () => {
    expect(() => new ThreatLockerClient({ instance: 'g' } as any)).toThrow('API key is required');
  });

  it('throws if instance is missing', () => {
    expect(() => new ThreatLockerClient({ apiKey: 'test' } as any)).toThrow('Instance is required');
  });

  it('constructs correct base URL', () => {
    const client = new ThreatLockerClient({ apiKey: 'test', instance: 'g' });
    expect(client.baseUrl).toBe('https://portalapi.g.threatlocker.com/portalapi');
  });
});
