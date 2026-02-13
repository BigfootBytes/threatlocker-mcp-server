import { z } from 'zod';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR';

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  has_more: boolean;
  nextPage: number | null;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  pagination?: Pagination;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    statusCode?: number;
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/** Zod shape describing the ApiResponse envelope — used as the default outputSchema for all tools. */
export const apiResponseOutputSchema = {
  success: z.boolean().describe('Whether the API call succeeded'),
  data: z.any().optional().describe('Response data (object or array) when success is true'),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
    has_more: z.boolean().describe('Whether more pages are available'),
    nextPage: z.number().nullable().describe('Next page number, or null if on the last page'),
  }).optional().describe('Pagination metadata when the response is a paginated list'),
  error: z.object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number().optional(),
  }).optional().describe('Error details when success is false'),
};

/** Reusable sub-schema for pagination in per-tool output schemas. */
export const paginationOutputSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  totalItems: z.number(),
  totalPages: z.number(),
  has_more: z.boolean().describe('Whether more pages are available'),
  nextPage: z.number().nullable().describe('Next page number, or null if on the last page'),
});

/** Reusable sub-schema for error details in per-tool output schemas. */
export const errorOutputSchema = z.object({
  code: z.string(),
  message: z.string(),
  statusCode: z.number().optional(),
});

export function successResponse<T>(data: T, pagination?: Pagination): SuccessResponse<T> {
  return pagination ? { success: true, data, pagination } : { success: true, data };
}

export function errorResponse(code: ErrorCode, message: string, statusCode?: number): ErrorResponse {
  return {
    success: false,
    error: { code, message, ...(statusCode && { statusCode }) },
  };
}

export function clampPagination(pageNumber?: number, pageSize?: number): { pageNumber: number; pageSize: number } {
  return {
    pageNumber: Math.max(1, Math.floor(pageNumber ?? 1)),
    pageSize: Math.max(1, Math.min(Math.floor(pageSize ?? 25), 500)),
  };
}

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateDateRange(startDate: string, endDate: string): ErrorResponse | null {
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  if (isNaN(start)) {
    return errorResponse('BAD_REQUEST', `Invalid startDate: ${startDate}`);
  }
  if (isNaN(end)) {
    return errorResponse('BAD_REQUEST', `Invalid endDate: ${endDate}`);
  }
  if (start > end) {
    return errorResponse('BAD_REQUEST', 'startDate must not be after endDate');
  }
  return null;
}

export function validateGuid(value: string, fieldName: string): ErrorResponse | null {
  if (!GUID_REGEX.test(value)) {
    return errorResponse('BAD_REQUEST', `${fieldName} must be a valid GUID`);
  }
  return null;
}

export function validateInstallKey(value: string): ErrorResponse | null {
  if (value.length !== 24) {
    return errorResponse('BAD_REQUEST', 'installKey must be exactly 24 characters');
  }
  return null;
}

const SHA256_REGEX = /^[0-9a-f]{64}$/i;

export function validateSha256(value: string, fieldName: string): ErrorResponse | null {
  if (!SHA256_REGEX.test(value)) {
    return errorResponse('BAD_REQUEST', `${fieldName} must be a 64-character hex string (SHA256)`);
  }
  return null;
}

export function mapHttpStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    default:
      return 'SERVER_ERROR';
  }
}
