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

// Mask an API key to show only first 4 and last 4 characters
function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return '****';
  }
  return `${key.substring(0, 4)}${'*'.repeat(key.length - 8)}${key.substring(key.length - 4)}`;
}

// Recursively sanitize data by replacing API key occurrences (depth-limited to prevent stack overflow)
function sanitizeLogData(data: unknown, apiKey: string, depth = 0): unknown {
  if (!apiKey || !data || depth > 10) return data;

  if (typeof data === 'string') {
    return data.split(apiKey).join(maskApiKey(apiKey));
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item, apiKey, depth + 1));
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeLogData(value, apiKey, depth + 1);
    }
    return sanitized;
  }

  return data;
}

export interface ClientConfig {
  apiKey: string;
  baseUrl: string;
  organizationId?: string;
  maxRetries?: number;
}

const RETRYABLE_STATUS_CODES = [408, 417, 429];

function isRetryableStatus(status: number): boolean {
  return status >= 500 || RETRYABLE_STATUS_CODES.includes(status);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class ThreatLockerClient {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly organizationId?: string;
  private readonly maxRetries: number;

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
    const envRetries = parseInt(process.env.THREATLOCKER_MAX_RETRIES ?? '', 10);
    const rawRetries = config.maxRetries ?? (Number.isFinite(envRetries) ? envRetries : 1);
    this.maxRetries = Math.max(0, rawRetries);
  }

  // Logger that sanitizes API keys from output
  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] > getLogLevel()) return;
    const timestamp = new Date().toISOString();
    const sanitizedData = data ? sanitizeLogData(data, this.apiKey) : undefined;
    const dataStr = sanitizedData ? ` ${JSON.stringify(sanitizedData)}` : '';
    console.error(`[${timestamp}] [${level}] ${message}${dataStr}`);
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

  private async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        if (response.ok || attempt >= this.maxRetries || !isRetryableStatus(response.status)) {
          return response;
        }
        this.log('INFO', `Retryable HTTP ${response.status}, attempt ${attempt + 1}/${this.maxRetries + 1}`, {
          url, status: response.status,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (attempt >= this.maxRetries) {
          throw lastError;
        }
        this.log('INFO', `Network error, attempt ${attempt + 1}/${this.maxRetries + 1}`, {
          url, error: lastError.message,
        });
      }
      await delay(500 * Math.pow(2, attempt));
    }
    // Should not reach here, but satisfy TypeScript
    throw lastError ?? new Error('Retry exhausted');
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

    this.log('DEBUG', 'API GET', { endpoint, params });

    try {
      const response = await this.fetchWithRetry(url.toString(), {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const code = mapHttpStatusToErrorCode(response.status);
        let errorBody: string | undefined;
        try {
          errorBody = await response.text();
        } catch { /* ignore */ }
        this.log('ERROR', 'API GET failed', {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          body: errorBody?.substring(0, 500)
        });
        return errorResponse(code, response.statusText, response.status);
      }

      const data = await response.json();
      this.log('DEBUG', 'API GET success', { endpoint, status: response.status });
      return successResponse<T>(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', 'API GET network error', { endpoint, error: message });
      return errorResponse('NETWORK_ERROR', message);
    }
  }

  async post<T>(
    endpoint: string,
    body: unknown,
    extractPagination?: (headers: Headers) => Pagination | undefined,
    customHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    this.log('DEBUG', 'API POST', { endpoint, body });

    try {
      const response = await this.fetchWithRetry(`${this.baseUrl}/${endpoint}`, {
        method: 'POST',
        headers: { ...this.getHeaders(), ...customHeaders },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const code = mapHttpStatusToErrorCode(response.status);
        let errorBody: string | undefined;
        try {
          errorBody = await response.text();
        } catch { /* ignore */ }
        this.log('ERROR', 'API POST failed', {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          body: errorBody?.substring(0, 500)
        });
        return errorResponse(code, response.statusText, response.status);
      }

      const data = await response.json();
      const pagination = extractPagination?.(response.headers);
      this.log('DEBUG', 'API POST success', { endpoint, status: response.status, hasPagination: !!pagination });
      return successResponse<T>(data, pagination);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', 'API POST network error', { endpoint, error: message });
      return errorResponse('NETWORK_ERROR', message);
    }
  }
}

export function extractPaginationFromJsonHeader(headers: Headers): Pagination | undefined {
  const raw = headers.get('pagination');
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw);
    const totalItems = parsed.totalItems;
    const totalPages = parsed.totalPages;
    if (typeof totalItems !== 'number' || typeof totalPages !== 'number') return undefined;

    const page = typeof parsed.currentPage === 'number' ? parsed.currentPage : 1;
    return {
      page,
      pageSize: typeof parsed.itemsPerPage === 'number' ? parsed.itemsPerPage : 25,
      totalItems,
      totalPages,
      has_more: page < totalPages,
      nextPage: page < totalPages ? page + 1 : null,
    };
  } catch {
    return undefined;
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
    const parsedTotalPages = parseInt(totalPages, 10);

    return {
      page,
      pageSize,
      totalItems: parseInt(totalItems, 10),
      totalPages: parsedTotalPages,
      has_more: page < parsedTotalPages,
      nextPage: page < parsedTotalPages ? page + 1 : null,
    };
  }
  return undefined;
}
