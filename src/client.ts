import {
  ApiResponse,
  Pagination,
  errorResponse,
  mapHttpStatusToErrorCode,
  successResponse,
} from './types/responses.js';

// Log levels: ERROR=0, INFO=1, DEBUG=2
const LOG_LEVELS = { ERROR: 0, INFO: 1, DEBUG: 2 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

function getLogLevel(): number {
  const level = (process.env.LOG_LEVEL || 'INFO').toUpperCase() as LogLevel;
  return LOG_LEVELS[level] ?? LOG_LEVELS.INFO;
}

// Simple logger for client operations
function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (LOG_LEVELS[level] > getLogLevel()) return;
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  console.error(`[${timestamp}] [${level}] ${message}${dataStr}`);
}

export interface ClientConfig {
  apiKey: string;
  baseUrl: string;
  organizationId?: string;
}

export class ThreatLockerClient {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly organizationId?: string;

  constructor(config: ClientConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }
    if (!config.baseUrl) {
      throw new Error('Base URL is required');
    }
    if (!config.baseUrl.startsWith('https://')) {
      throw new Error('Base URL must use HTTPS');
    }

    this.apiKey = config.apiKey;
    this.organizationId = config.organizationId;
    // Remove trailing slash if present
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': this.apiKey,
    };
    if (this.organizationId) {
      headers['ManagedOrganizationId'] = this.organizationId;
      headers['OverrideManagedOrganizationId'] = this.organizationId;
    }
    return headers;
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, value);
        }
      });
    }

    log('DEBUG', 'API GET', { endpoint, params });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const code = mapHttpStatusToErrorCode(response.status);
        let errorBody: string | undefined;
        try {
          errorBody = await response.text();
        } catch { /* ignore */ }
        log('ERROR', 'API GET failed', {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          body: errorBody?.substring(0, 500)
        });
        return errorResponse(code, response.statusText, response.status);
      }

      const data = await response.json();
      log('DEBUG', 'API GET success', { endpoint, status: response.status });
      return successResponse<T>(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('ERROR', 'API GET network error', { endpoint, error: message });
      return errorResponse('NETWORK_ERROR', message);
    }
  }

  async post<T>(
    endpoint: string,
    body: unknown,
    extractPagination?: (headers: Headers) => Pagination | undefined
  ): Promise<ApiResponse<T>> {
    log('DEBUG', 'API POST', { endpoint, body });

    try {
      const response = await fetch(`${this.baseUrl}/${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const code = mapHttpStatusToErrorCode(response.status);
        let errorBody: string | undefined;
        try {
          errorBody = await response.text();
        } catch { /* ignore */ }
        log('ERROR', 'API POST failed', {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          body: errorBody?.substring(0, 500)
        });
        return errorResponse(code, response.statusText, response.status);
      }

      const data = await response.json();
      const pagination = extractPagination?.(response.headers);
      log('DEBUG', 'API POST success', { endpoint, status: response.status, hasPagination: !!pagination });
      return successResponse<T>(data, pagination);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('ERROR', 'API POST network error', { endpoint, error: message });
      return errorResponse('NETWORK_ERROR', message);
    }
  }
}

export function extractPaginationFromHeaders(headers: Headers): Pagination | undefined {
  const totalItems = headers.get('totalItems');
  const totalPages = headers.get('totalPages');
  const firstItem = headers.get('firstItem');
  const lastItem = headers.get('lastItem');

  if (totalItems && totalPages) {
    const first = parseInt(firstItem || '1', 10);
    const last = parseInt(lastItem || '1', 10);
    const pageSize = last - first + 1;
    const page = Math.floor(first / pageSize) + 1;

    return {
      page,
      pageSize,
      totalItems: parseInt(totalItems, 10),
      totalPages: parseInt(totalPages, 10),
    };
  }
  return undefined;
}
