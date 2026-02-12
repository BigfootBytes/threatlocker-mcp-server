import { describe, it, expect } from 'vitest';
import { formatAsMarkdown, formatObject, formatPagination } from './formatters.js';
import type { ApiResponse, Pagination } from './types/responses.js';

describe('formatAsMarkdown', () => {
  it('formats error response with statusCode', () => {
    const response: ApiResponse<unknown> = {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key', statusCode: 401 },
    };
    const result = formatAsMarkdown(response);
    expect(result).toBe('# Error 401: UNAUTHORIZED\n\nInvalid API key');
  });

  it('formats error response without statusCode', () => {
    const response: ApiResponse<unknown> = {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Connection refused' },
    };
    const result = formatAsMarkdown(response);
    expect(result).toBe('# Error: NETWORK_ERROR\n\nConnection refused');
  });

  it('formats empty array', () => {
    const response: ApiResponse<unknown[]> = { success: true, data: [] };
    const result = formatAsMarkdown(response);
    expect(result).toBe('**0 items returned**');
  });

  it('formats array with items', () => {
    const response: ApiResponse<unknown[]> = {
      success: true,
      data: [
        { name: 'Computer1', id: 'abc-123' },
        { name: 'Computer2', id: 'def-456' },
      ],
    };
    const result = formatAsMarkdown(response);
    expect(result).toContain('**2 items returned**');
    expect(result).toContain('- **name**: Computer1');
    expect(result).toContain('- **id**: abc-123');
    expect(result).toContain('- **name**: Computer2');
  });

  it('formats single object', () => {
    const response: ApiResponse<Record<string, unknown>> = {
      success: true,
      data: { name: 'MyComputer', status: 'Secure', agentVersion: '9.3.3' },
    };
    const result = formatAsMarkdown(response);
    expect(result).toContain('- **name**: MyComputer');
    expect(result).toContain('- **status**: Secure');
    expect(result).toContain('- **agentVersion**: 9.3.3');
  });

  it('formats nested objects with indentation', () => {
    const response: ApiResponse<Record<string, unknown>> = {
      success: true,
      data: {
        name: 'Policy1',
        options: { ringfenced: true, elevated: false },
      },
    };
    const result = formatAsMarkdown(response);
    expect(result).toContain('- **name**: Policy1');
    expect(result).toContain('- **options**:');
    expect(result).toContain('  - **ringfenced**: true');
    expect(result).toContain('  - **elevated**: false');
  });

  it('formats arrays-in-objects as summary', () => {
    const response: ApiResponse<Record<string, unknown>> = {
      success: true,
      data: {
        name: 'App1',
        files: ['a.exe', 'b.dll', 'c.sys'],
      },
    };
    const result = formatAsMarkdown(response);
    expect(result).toContain('- **files**: [3 items]');
  });

  it('formats null values', () => {
    const response: ApiResponse<Record<string, unknown>> = {
      success: true,
      data: { name: 'Test', description: null },
    };
    const result = formatAsMarkdown(response);
    expect(result).toContain('- **description**: _null_');
  });

  it('formats undefined values as null', () => {
    const response: ApiResponse<Record<string, unknown>> = {
      success: true,
      data: { name: 'Test', optional: undefined },
    };
    const result = formatAsMarkdown(response);
    expect(result).toContain('- **optional**: _null_');
  });

  it('includes pagination footer when present', () => {
    const response: ApiResponse<unknown[]> = {
      success: true,
      data: [{ id: '1' }],
      pagination: { page: 2, pageSize: 25, totalItems: 100, totalPages: 4 },
    };
    const result = formatAsMarkdown(response);
    expect(result).toContain('Page 2 of 4');
    expect(result).toContain('items 26–50 of 100');
    expect(result).toContain('pageSize 25');
  });

  it('omits pagination footer when absent', () => {
    const response: ApiResponse<unknown[]> = {
      success: true,
      data: [{ id: '1' }],
    };
    const result = formatAsMarkdown(response);
    expect(result).not.toContain('Page');
    expect(result).not.toContain('---');
  });

  it('formats primitive data values', () => {
    const response: ApiResponse<number> = { success: true, data: 42 };
    const result = formatAsMarkdown(response);
    expect(result).toBe('42');
  });

  it('formats array of primitive values', () => {
    const response: ApiResponse<string[]> = {
      success: true,
      data: ['alpha', 'beta'],
    };
    const result = formatAsMarkdown(response);
    expect(result).toContain('- alpha');
    expect(result).toContain('- beta');
  });

  it('singular "item" for single-element array', () => {
    const response: ApiResponse<unknown[]> = {
      success: true,
      data: [{ id: '1' }],
    };
    const result = formatAsMarkdown(response);
    expect(result).toContain('**1 item returned**');
  });

  it('singular "item" for single-element nested array', () => {
    const response: ApiResponse<Record<string, unknown>> = {
      success: true,
      data: { tags: ['only-one'] },
    };
    const result = formatAsMarkdown(response);
    expect(result).toContain('[1 item]');
  });
});

describe('formatObject', () => {
  it('renders flat object with no indent', () => {
    const result = formatObject({ a: 1, b: 'two' }, 0);
    expect(result).toBe('- **a**: 1\n- **b**: two');
  });

  it('renders with indent level', () => {
    const result = formatObject({ x: true }, 2);
    expect(result).toBe('    - **x**: true');
  });
});

describe('formatPagination', () => {
  it('computes correct item range for first page', () => {
    const p: Pagination = { page: 1, pageSize: 25, totalItems: 100, totalPages: 4 };
    const result = formatPagination(p);
    expect(result).toContain('items 1–25 of 100');
  });

  it('computes correct item range for last partial page', () => {
    const p: Pagination = { page: 3, pageSize: 25, totalItems: 55, totalPages: 3 };
    const result = formatPagination(p);
    expect(result).toContain('items 51–55 of 55');
  });
});
