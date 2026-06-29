import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ThreatLockerClient } from './client.js';
import { allTools, ToolDefinition, isWriteBlocked } from './tools/registry.js';
import { ApiResponse, apiResponseOutputSchema, SuccessResponse, errorResponse } from './types/responses.js';
import { formatAsMarkdown } from './formatters.js';
import { VERSION } from './version.js';
import { allResources } from './resources/registry.js';
import { allPrompts } from './prompts/registry.js';

export type LogFn = (level: 'DEBUG' | 'ERROR', message: string, data?: Record<string, unknown>) => void;

export const CHARACTER_LIMIT = 50_000;
export const MAX_AUTO_PAGES = 10;

/**
 * Auto-fetch all pages by calling the handler repeatedly until has_more is false
 * or MAX_AUTO_PAGES is reached. Merges data arrays across pages.
 */
export async function fetchAllPagesLoop(
  handler: (client: ThreatLockerClient, args: Record<string, unknown>) => Promise<ApiResponse<unknown>>,
  client: ThreatLockerClient,
  args: Record<string, unknown>,
  log?: LogFn,
  toolName?: string,
): Promise<ApiResponse<unknown>> {
  const firstResult = await handler(client, { ...args, pageNumber: 1 });

  // If not successful, not an array, or no pagination → return as-is
  if (!firstResult.success || !firstResult.pagination?.has_more || !Array.isArray(firstResult.data)) {
    return firstResult;
  }

  const allData: unknown[] = [...firstResult.data];
  let currentPage = firstResult.pagination.nextPage ?? 2;
  let totalPages = firstResult.pagination.totalPages;
  let totalItems = firstResult.pagination.totalItems;
  let pagesFetched = 1;

  while (pagesFetched < MAX_AUTO_PAGES) {
    log?.('DEBUG', `fetchAllPages: page ${currentPage}/${totalPages}`, { toolName, pagesFetched });
    const pageResult = await handler(client, { ...args, pageNumber: currentPage });

    if (!pageResult.success) {
      // Return what we have so far with a summary pagination
      log?.('ERROR', `fetchAllPages: page ${currentPage} failed`, { toolName, error: (pageResult as any).error });
      break;
    }

    if (Array.isArray(pageResult.data)) {
      allData.push(...pageResult.data);
    }
    pagesFetched++;

    if (!pageResult.pagination?.has_more) {
      break;
    }
    currentPage = pageResult.pagination.nextPage ?? currentPage + 1;
    totalPages = pageResult.pagination.totalPages;
    totalItems = pageResult.pagination.totalItems;
  }

  const result: SuccessResponse<unknown> = {
    success: true,
    data: allData,
    pagination: {
      page: 1,
      pageSize: allData.length,
      totalItems,
      totalPages,
      has_more: pagesFetched >= MAX_AUTO_PAGES && currentPage <= totalPages,
      nextPage: pagesFetched >= MAX_AUTO_PAGES && currentPage <= totalPages ? currentPage : null,
    },
  };
  return result;
}

/**
 * Bound a successful array response so its serialized size stays under `maxChars`.
 * Some endpoints (e.g. a grouped action_log search) return very wide rows; the full
 * `data` array is echoed in `structuredContent`, which can exceed the client's token
 * limit and fail the whole call. We drop trailing rows until it fits — each retained
 * row keeps its full shape, so it still satisfies the tool's output schema. Returns
 * the (possibly trimmed) result plus the number of rows dropped (0 if untouched).
 */
export function capResultData(
  result: ApiResponse<unknown>,
  maxChars: number = CHARACTER_LIMIT,
): { result: ApiResponse<unknown>; droppedRows: number } {
  if (!result.success || !Array.isArray(result.data)) return { result, droppedRows: 0 };
  const data = result.data;
  if (JSON.stringify(result).length <= maxChars) return { result, droppedRows: 0 };

  let keep = data.length;
  while (keep > 0) {
    const trial = { ...result, data: data.slice(0, keep) };
    if (JSON.stringify(trial).length <= maxChars) break;
    keep = Math.max(0, keep - Math.max(1, Math.ceil(keep * 0.2)));
  }
  return {
    result: { ...result, data: data.slice(0, keep) },
    droppedRows: data.length - keep,
  };
}

export function createMcpServer(client: ThreatLockerClient, log?: LogFn): McpServer {
  const server = new McpServer({
    name: 'threatlocker-mcp-server',
    version: VERSION,
  });

  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: {
          ...tool.zodSchema,
          response_format: z.enum(['json', 'markdown']).default('markdown')
            .describe('Output format: markdown (default, human-readable) or json (structured)'),
          fetchAllPages: z.boolean().default(false)
            .describe('Fetch all pages automatically (max 10 pages). Default: false (single page).'),
        },
        outputSchema: tool.outputZodSchema ?? apiResponseOutputSchema,
        annotations: tool.annotations ?? {},
      },
      async (args) => {
        const { response_format, fetchAllPages, ...toolArgs } = args as Record<string, unknown>;
        const format = response_format === 'json' ? 'json' : 'markdown';

        const action = toolArgs.action as string | undefined;
        if (action && isWriteBlocked(tool.writeActions, action)) {
          const result = errorResponse('FORBIDDEN', 'Server is in read-only mode (THREATLOCKER_READ_ONLY is set). Write operations are disabled.');
          const text = format === 'markdown' ? formatAsMarkdown(result) : JSON.stringify(result, null, 2);
          return {
            content: [{ type: 'text' as const, text }],
            structuredContent: result as unknown as Record<string, unknown>,
            isError: true,
          };
        }

        log?.('DEBUG', `Tool call: ${tool.name}`, { args: toolArgs, fetchAllPages, baseUrl: client.baseUrl });

        let result: ApiResponse<unknown>;
        if (fetchAllPages) {
          result = await fetchAllPagesLoop(tool.handler, client, toolArgs, log, tool.name);
        } else {
          result = await tool.handler(client, toolArgs);
        }

        if (!result.success) {
          log?.('ERROR', `Tool failed: ${tool.name}`, { error: result.error });
        } else {
          const count = Array.isArray(result.data) ? result.data.length : 1;
          log?.('DEBUG', `Tool success: ${tool.name}`, { resultCount: count, pagination: result.pagination });
        }

        // Bound oversized array responses so structuredContent stays under the client's
        // token limit (a full grouped result can be 100s of KB and fail the whole call).
        const { result: bounded, droppedRows } = capResultData(result);

        let text = format === 'markdown'
          ? formatAsMarkdown(bounded)
          : JSON.stringify(bounded, null, 2);

        if (droppedRows > 0) {
          text += format === 'markdown'
            ? `\n\n---\n**${droppedRows} more row(s) omitted** to fit the response size limit. Use a smaller \`pageSize\`, add filters, or use \`groupBys\` to aggregate.`
            : `\n\n--- ${droppedRows} more row(s) omitted to fit the response size limit. Use a smaller pageSize, add filters, or groupBys to aggregate. ---`;
        }

        if (text.length > CHARACTER_LIMIT) {
          const notice = format === 'markdown'
            ? '\n\n---\n**Output truncated** (exceeded 50,000 characters). Use a smaller `pageSize` or add filters to narrow results.'
            : '\n\n--- OUTPUT TRUNCATED (exceeded 50,000 characters). Use a smaller pageSize or add filters to narrow results. ---';
          text = text.slice(0, CHARACTER_LIMIT) + notice;
        }

        return {
          content: [{ type: 'text' as const, text }],
          structuredContent: bounded as unknown as Record<string, unknown>,
          isError: !result.success,
        };
      }
    );
  }

  // Register static resources
  for (const res of allResources) {
    server.resource(
      res.name,
      res.uri,
      { description: res.description, mimeType: res.mimeType },
      async () => ({
        contents: [{
          uri: res.uri,
          mimeType: res.mimeType,
          text: JSON.stringify(res.getData(), null, 2),
        }],
      }),
    );
  }

  // Register prompt templates
  for (const prompt of allPrompts) {
    server.registerPrompt(
      prompt.name,
      {
        title: prompt.title,
        description: prompt.description,
        argsSchema: prompt.argsSchema,
      },
      async (args) => prompt.cb(args as Record<string, string>),
    );
  }

  return server;
}
