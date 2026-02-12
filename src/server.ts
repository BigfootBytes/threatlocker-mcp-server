import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ThreatLockerClient } from './client.js';
import { allTools } from './tools/registry.js';
import { apiResponseOutputSchema } from './types/responses.js';
import { VERSION } from './version.js';

export type LogFn = (level: 'DEBUG' | 'ERROR', message: string, data?: Record<string, unknown>) => void;

export function createMcpServer(client: ThreatLockerClient, log?: LogFn): McpServer {
  const server = new McpServer({
    name: 'threatlocker-mcp',
    version: VERSION,
  });

  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.zodSchema,
        outputSchema: tool.outputZodSchema ?? apiResponseOutputSchema,
        annotations: tool.annotations ?? {},
      },
      async (args) => {
        log?.('DEBUG', `Tool call: ${tool.name}`, { args, baseUrl: client.baseUrl });
        const result = await tool.handler(client, args as Record<string, unknown>);
        if (!result.success) {
          log?.('ERROR', `Tool failed: ${tool.name}`, { error: result.error });
        } else {
          const count = Array.isArray(result.data) ? result.data.length : 1;
          log?.('DEBUG', `Tool success: ${tool.name}`, { resultCount: count, pagination: result.pagination });
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      }
    );
  }

  return server;
}
