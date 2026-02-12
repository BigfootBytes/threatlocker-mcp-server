import { describe, it, expect } from 'vitest';
import {
  successResponse,
  errorResponse,
  mapHttpStatusToErrorCode,
  validateDateRange,
  validateGuid,
  validateInstallKey,
  validateSha256,
} from './responses.js';

describe('successResponse', () => {
  it('returns success with data and no pagination', () => {
    const result = successResponse({ items: [1, 2] });
    expect(result).toEqual({ success: true, data: { items: [1, 2] } });
    expect(result).not.toHaveProperty('pagination');
  });

  it('includes pagination when provided', () => {
    const pagination = { page: 2, pageSize: 25, totalItems: 100, totalPages: 4, has_more: true, nextPage: 3 as number | null };
    const result = successResponse('data', pagination);
    expect(result).toEqual({ success: true, data: 'data', pagination });
  });
});

describe('errorResponse', () => {
  it('returns error with code and message', () => {
    const result = errorResponse('BAD_REQUEST', 'missing field');
    expect(result).toEqual({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'missing field' },
    });
  });

  it('includes statusCode when provided', () => {
    const result = errorResponse('UNAUTHORIZED', 'bad key', 401);
    expect(result).toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'bad key', statusCode: 401 },
    });
  });

  it('omits statusCode when zero or undefined', () => {
    const result = errorResponse('SERVER_ERROR', 'boom');
    expect(result.error).not.toHaveProperty('statusCode');
  });
});

describe('mapHttpStatusToErrorCode', () => {
  it('maps 400 to BAD_REQUEST', () => {
    expect(mapHttpStatusToErrorCode(400)).toBe('BAD_REQUEST');
  });

  it('maps 401 to UNAUTHORIZED', () => {
    expect(mapHttpStatusToErrorCode(401)).toBe('UNAUTHORIZED');
  });

  it('maps 403 to FORBIDDEN', () => {
    expect(mapHttpStatusToErrorCode(403)).toBe('FORBIDDEN');
  });

  it('maps 404 to NOT_FOUND', () => {
    expect(mapHttpStatusToErrorCode(404)).toBe('NOT_FOUND');
  });

  it('maps 500 to SERVER_ERROR', () => {
    expect(mapHttpStatusToErrorCode(500)).toBe('SERVER_ERROR');
  });

  it('maps unknown status codes to SERVER_ERROR', () => {
    expect(mapHttpStatusToErrorCode(502)).toBe('SERVER_ERROR');
    expect(mapHttpStatusToErrorCode(429)).toBe('SERVER_ERROR');
  });
});

describe('validateDateRange', () => {
  it('returns null for a valid date range', () => {
    expect(validateDateRange('2025-01-01T00:00:00Z', '2025-01-31T23:59:59Z')).toBeNull();
  });

  it('returns null when startDate equals endDate', () => {
    expect(validateDateRange('2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')).toBeNull();
  });

  it('returns error for invalid startDate', () => {
    const result = validateDateRange('not-a-date', '2025-01-31T23:59:59Z');
    expect(result).not.toBeNull();
    expect(result!.error.code).toBe('BAD_REQUEST');
    expect(result!.error.message).toContain('startDate');
  });

  it('returns error for invalid endDate', () => {
    const result = validateDateRange('2025-01-01T00:00:00Z', 'not-a-date');
    expect(result).not.toBeNull();
    expect(result!.error.code).toBe('BAD_REQUEST');
    expect(result!.error.message).toContain('endDate');
  });

  it('returns error when startDate is after endDate', () => {
    const result = validateDateRange('2025-02-01T00:00:00Z', '2025-01-01T00:00:00Z');
    expect(result).not.toBeNull();
    expect(result!.error.code).toBe('BAD_REQUEST');
    expect(result!.error.message).toContain('startDate must not be after endDate');
  });
});

describe('validateGuid', () => {
  it('returns null for a valid lowercase GUID', () => {
    expect(validateGuid('12345678-1234-1234-1234-123456789abc', 'testField')).toBeNull();
  });

  it('returns null for a valid uppercase GUID', () => {
    expect(validateGuid('12345678-1234-1234-1234-123456789ABC', 'testField')).toBeNull();
  });

  it('returns error for an invalid string', () => {
    const result = validateGuid('not-a-guid', 'testField');
    expect(result).not.toBeNull();
    expect(result!.error.code).toBe('BAD_REQUEST');
    expect(result!.error.message).toBe('testField must be a valid GUID');
  });

  it('returns error for an empty string', () => {
    const result = validateGuid('', 'myId');
    expect(result).not.toBeNull();
    expect(result!.error.code).toBe('BAD_REQUEST');
    expect(result!.error.message).toBe('myId must be a valid GUID');
  });
});

describe('validateInstallKey', () => {
  it('returns null for a 24-character key', () => {
    expect(validateInstallKey('ABC123DEF456GHI789JKL012')).toBeNull();
  });

  it('returns error for a key that is too short', () => {
    const result = validateInstallKey('SHORT');
    expect(result).not.toBeNull();
    expect(result!.error.code).toBe('BAD_REQUEST');
    expect(result!.error.message).toBe('installKey must be exactly 24 characters');
  });

  it('returns error for a key that is too long', () => {
    const result = validateInstallKey('A'.repeat(25));
    expect(result).not.toBeNull();
    expect(result!.error.code).toBe('BAD_REQUEST');
  });
});

describe('validateSha256', () => {
  it('returns null for a valid lowercase SHA256 hash', () => {
    expect(validateSha256('a'.repeat(64), 'hash')).toBeNull();
  });

  it('returns null for a valid uppercase SHA256 hash', () => {
    expect(validateSha256('A'.repeat(64), 'hash')).toBeNull();
  });

  it('returns null for a valid mixed-case SHA256 hash', () => {
    expect(validateSha256('aB1c2D3e'.repeat(8), 'hash')).toBeNull();
  });

  it('returns error for a hash that is too short', () => {
    const result = validateSha256('abc123', 'myHash');
    expect(result).not.toBeNull();
    expect(result!.error.code).toBe('BAD_REQUEST');
    expect(result!.error.message).toBe('myHash must be a 64-character hex string (SHA256)');
  });

  it('returns error for a hash with invalid characters', () => {
    const result = validateSha256('g'.repeat(64), 'hash');
    expect(result).not.toBeNull();
    expect(result!.error.code).toBe('BAD_REQUEST');
  });

  it('returns error for an empty string', () => {
    const result = validateSha256('', 'hash');
    expect(result).not.toBeNull();
    expect(result!.error.code).toBe('BAD_REQUEST');
  });
});
