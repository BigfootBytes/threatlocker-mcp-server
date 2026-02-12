import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ThreatLockerClient } from './client.js';
import { allTools } from './tools/registry.js';
import { apiResponseOutputSchema } from './types/responses.js';
import { formatAsMarkdown } from './formatters.js';
import { VERSION } from './version.js';

export type LogFn = (level: 'DEBUG' | 'ERROR', message: string, data?: Record<string, unknown>) => void;

export const CHARACTER_LIMIT = 50_000;

export function createMcpServer(client: ThreatLockerClient, log?: LogFn): McpServer {
  const server = new McpServer({
    name: 'threatlocker-mcp',
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
        },
        outputSchema: tool.outputZodSchema ?? apiResponseOutputSchema,
        annotations: tool.annotations ?? {},
      },
      async (args) => {
        const { response_format, ...toolArgs } = args as Record<string, unknown>;
        const format = response_format === 'json' ? 'json' : 'markdown';

        log?.('DEBUG', `Tool call: ${tool.name}`, { args: toolArgs, baseUrl: client.baseUrl });
        const result = await tool.handler(client, toolArgs);
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

  return server;
}
