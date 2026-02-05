import { describe, it, expect, vi } from 'vitest';
import { ThreatLockerClient } from './client.js';

describe('ThreatLockerClient', () => {
  it('throws if API key is missing', () => {
    expect(() => new ThreatLockerClient({ baseUrl: 'https://example.com' } as any)).toThrow('API key is required');
  });

  it('throws if base URL is missing', () => {
    expect(() => new ThreatLockerClient({ apiKey: 'test' } as any)).toThrow('Base URL is required');
  });

  it('throws if base URL is not HTTPS', () => {
    expect(() => new ThreatLockerClient({ apiKey: 'test', baseUrl: 'http://example.com' })).toThrow('Base URL must use HTTPS');
  });

  it('stores base URL correctly', () => {
    const client = new ThreatLockerClient({ apiKey: 'test', baseUrl: 'https://portalapi.g.threatlocker.com/portalapi' });
    expect(client.baseUrl).toBe('https://portalapi.g.threatlocker.com/portalapi');
  });

  it('removes trailing slash from base URL', () => {
    const client = new ThreatLockerClient({ apiKey: 'test', baseUrl: 'https://portalapi.g.threatlocker.com/portalapi/' });
    expect(client.baseUrl).toBe('https://portalapi.g.threatlocker.com/portalapi');
  });

  it('passes custom headers to POST requests', async () => {
    const client = new ThreatLockerClient({ apiKey: 'test-api-key', baseUrl: 'https://portalapi.g.threatlocker.com/portalapi' });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'ok' }),
      headers: new Headers(),
    });

    await client.post('TestEndpoint', { data: 'test' }, undefined, { 'X-Custom': 'value' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Custom': 'value' }),
      })
    );
  });
});
