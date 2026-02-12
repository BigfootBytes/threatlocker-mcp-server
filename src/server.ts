import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ThreatLockerClient } from './client.js';
import { allTools, ToolDefinition } from './tools/registry.js';
import { ApiResponse, apiResponseOutputSchema, SuccessResponse } from './types/responses.js';
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

        let text = format === 'markdown'
          ? formatAsMarkdown(result)
          : JSON.stringify(result, null, 2);

        if (text.length > CHARACTER_LIMIT) {
          const truncated = text.slice(0, CHARACTER_LIMIT);
          const notice = format === 'markdown'
            ? '\n\n---\n**Output truncated** (exceeded 50,000 characters). Use a smaller `pageSize` or add filters to narrow results.'
            : '\n\n--- OUTPUT TRUNCATED (exceeded 50,000 characters). Use a smaller pageSize or add filters to narrow results. ---';
          text = truncated + notice;
        }

        return {
          content: [{ type: 'text' as const, text }],
          structuredContent: result as unknown as Record<string, unknown>,
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
