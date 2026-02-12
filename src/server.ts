import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ThreatLockerClient } from './client.js';
import { allTools } from './tools/registry.js';
import { VERSION } from './version.js';

export type LogFn = (level: 'DEBUG' | 'ERROR', message: string, data?: Record<string, unknown>) => void;

export function createMcpServer(client: ThreatLockerClient, log?: LogFn): McpServer {
  const server = new McpServer({
    name: 'threatlocker-mcp',
    version: VERSION,
  });

  for (const tool of allTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.zodSchema,
      tool.annotations ?? {},
      async (args) => {
        log?.('DEBUG', `Tool call: ${tool.name}`, { args, baseUrl: client.baseUrl });
        const result = await tool.handler(client, args);
        if (!result.success) {
          log?.('ERROR', `Tool failed: ${tool.name}`, { error: result.error });
        } else {
          const count = Array.isArray(result.data) ? result.data.length : 1;
          log?.('DEBUG', `Tool success: ${tool.name}`, { resultCount: count, pagination: result.pagination });
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
    );
  }

  return server;
}
