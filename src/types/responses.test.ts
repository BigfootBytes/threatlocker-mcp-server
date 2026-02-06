import { describe, it, expect } from 'vitest';
import {
  successResponse,
  errorResponse,
  mapHttpStatusToErrorCode,
} from './responses.js';

describe('successResponse', () => {
  it('returns success with data and no pagination', () => {
    const result = successResponse({ items: [1, 2] });
    expect(result).toEqual({ success: true, data: { items: [1, 2] } });
    expect(result).not.toHaveProperty('pagination');
  });

  it('includes pagination when provided', () => {
    const pagination = { page: 2, pageSize: 25, totalItems: 100, totalPages: 4 };
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
