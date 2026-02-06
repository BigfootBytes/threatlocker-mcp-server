import { describe, it, expect, vi } from 'vitest';
import { ThreatLockerClient } from './client.js';
import { clampPagination } from './types/responses.js';

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

  it('sanitizes API key from error logs without stack overflow on deep objects', async () => {
    const client = new ThreatLockerClient({ apiKey: 'test-api-key-12345678', baseUrl: 'https://portalapi.g.threatlocker.com/portalapi' });

    // Build a deeply nested object (15 levels, beyond the depth limit of 10)
    let deep: Record<string, unknown> = { key: 'test-api-key-12345678' };
    for (let i = 0; i < 15; i++) {
      deep = { nested: deep };
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: async () => JSON.stringify(deep),
    });

    // Should not throw (depth limit prevents stack overflow)
    const result = await client.get('TestEndpoint');
    expect(result.success).toBe(false);
  });
});

describe('clampPagination', () => {
  it('returns defaults when no arguments provided', () => {
    expect(clampPagination()).toEqual({ pageNumber: 1, pageSize: 25 });
  });

  it('returns defaults for undefined values', () => {
    expect(clampPagination(undefined, undefined)).toEqual({ pageNumber: 1, pageSize: 25 });
  });

  it('passes through valid values', () => {
    expect(clampPagination(3, 50)).toEqual({ pageNumber: 3, pageSize: 50 });
  });

  it('clamps pageSize to max 500', () => {
    expect(clampPagination(1, 999999)).toEqual({ pageNumber: 1, pageSize: 500 });
  });

  it('clamps pageSize to min 1', () => {
    expect(clampPagination(1, 0)).toEqual({ pageNumber: 1, pageSize: 1 });
    expect(clampPagination(1, -5)).toEqual({ pageNumber: 1, pageSize: 1 });
  });

  it('clamps pageNumber to min 1', () => {
    expect(clampPagination(0, 25)).toEqual({ pageNumber: 1, pageSize: 25 });
    expect(clampPagination(-3, 25)).toEqual({ pageNumber: 1, pageSize: 25 });
  });

  it('floors fractional values', () => {
    expect(clampPagination(2.7, 30.9)).toEqual({ pageNumber: 2, pageSize: 30 });
  });
});
