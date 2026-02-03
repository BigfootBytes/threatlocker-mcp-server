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

export function successResponse<T>(data: T, pagination?: Pagination): SuccessResponse<T> {
  return pagination ? { success: true, data, pagination } : { success: true, data };
}

export function errorResponse(code: ErrorCode, message: string, statusCode?: number): ErrorResponse {
  return {
    success: false,
    error: { code, message, ...(statusCode && { statusCode }) },
  };
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
