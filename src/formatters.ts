import type { ApiResponse, Pagination } from './types/responses.js';

/**
 * Format an ApiResponse as human-readable markdown.
 */
export function formatAsMarkdown(response: ApiResponse<unknown>): string {
  if (!response.success) {
    const { code, message, statusCode } = response.error;
    const heading = statusCode ? `# Error ${statusCode}: ${code}` : `# Error: ${code}`;
    return `${heading}\n\n${message}`;
  }

  const parts: string[] = [];
  const { data, pagination } = response;

  if (Array.isArray(data)) {
    parts.push(`**${data.length} item${data.length !== 1 ? 's' : ''} returned**\n`);
    for (const item of data) {
      if (item !== null && typeof item === 'object') {
        parts.push(formatObject(item as Record<string, unknown>, 0));
        parts.push(''); // blank line between items
      } else {
        parts.push(`- ${String(item)}`);
      }
    }
  } else if (data !== null && typeof data === 'object') {
    parts.push(formatObject(data as Record<string, unknown>, 0));
  } else {
    parts.push(String(data));
  }

  if (pagination) {
    parts.push(formatPagination(pagination));
  }

  return parts.join('\n').trim();
}

/**
 * Render a key-value object as bulleted markdown lines.
 * Nested objects are indented; arrays are summarized as `[N items]`.
 */
export function formatObject(obj: Record<string, unknown>, indent: number): string {
  const prefix = '  '.repeat(indent);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      lines.push(`${prefix}- **${key}**: _null_`);
    } else if (Array.isArray(value)) {
      lines.push(`${prefix}- **${key}**: [${value.length} item${value.length !== 1 ? 's' : ''}]`);
    } else if (typeof value === 'object') {
      lines.push(`${prefix}- **${key}**:`);
      lines.push(formatObject(value as Record<string, unknown>, indent + 1));
    } else {
      lines.push(`${prefix}- **${key}**: ${String(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Render pagination metadata as a markdown footer.
 */
export function formatPagination(pagination: Pagination): string {
  const { page, pageSize, totalItems, totalPages } = pagination;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return `\n---\nPage ${page} of ${totalPages} (items ${start}–${end} of ${totalItems}, pageSize ${pageSize})`;
}
