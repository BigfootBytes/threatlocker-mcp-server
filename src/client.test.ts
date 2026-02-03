import { describe, it, expect } from 'vitest';
import { ThreatLockerClient } from './client.js';

describe('ThreatLockerClient', () => {
  it('throws if API key is missing', () => {
    expect(() => new ThreatLockerClient({ baseUrl: 'https://example.com' } as any)).toThrow('API key is required');
  });

  it('throws if base URL is missing', () => {
    expect(() => new ThreatLockerClient({ apiKey: 'test' } as any)).toThrow('Base URL is required');
  });

  it('stores base URL correctly', () => {
    const client = new ThreatLockerClient({ apiKey: 'test', baseUrl: 'https://portalapi.g.threatlocker.com/portalapi' });
    expect(client.baseUrl).toBe('https://portalapi.g.threatlocker.com/portalapi');
  });

  it('removes trailing slash from base URL', () => {
    const client = new ThreatLockerClient({ apiKey: 'test', baseUrl: 'https://portalapi.g.threatlocker.com/portalapi/' });
    expect(client.baseUrl).toBe('https://portalapi.g.threatlocker.com/portalapi');
  });
});
