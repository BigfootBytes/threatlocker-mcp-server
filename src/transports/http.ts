import express, { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ThreatLockerClient } from '../client.js';
import { computersToolSchema, handleComputersTool } from '../tools/computers.js';
import { computerGroupsToolSchema, handleComputerGroupsTool } from '../tools/computer-groups.js';
import { applicationsToolSchema, handleApplicationsTool } from '../tools/applications.js';
import { policiesToolSchema, handlePoliciesTool } from '../tools/policies.js';

interface ClientCredentials {
  apiKey: string;
  baseUrl: string;
  organizationId?: string;
}

function extractCredentials(req: Request): ClientCredentials | null {
  const apiKey = req.headers['authorization'] as string;
  const baseUrl = req.headers['x-threatlocker-base-url'] as string;
  const organizationId = req.headers['x-threatlocker-org-id'] as string | undefined;

  if (!apiKey || !baseUrl) {
    return null;
  }

  return { apiKey, baseUrl, organizationId };
}

async function handleToolCall(
  client: ThreatLockerClient,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'computers':
      return handleComputersTool(client, args);
    case 'computer_groups':
      return handleComputerGroupsTool(client, args);
    case 'applications':
      return handleApplicationsTool(client, args);
    case 'policies':
      return handlePoliciesTool(client, args);
    default:
      return { success: false, error: { code: 'BAD_REQUEST', message: `Unknown tool: ${name}` } };
  }
}

export function createHttpServer(port: number): void {
  const app = express();
  app.use(express.json());

  // Health check - no auth required
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', transport: 'http', version: '0.2.0' });
  });

  // List available tools
  app.get('/tools', (_req, res) => {
    res.json({
      tools: [
        computersToolSchema,
        computerGroupsToolSchema,
        applicationsToolSchema,
        policiesToolSchema,
      ],
    });
  });

  // Call a tool - requires auth headers
  app.post('/tools/:toolName', async (req: Request, res: Response) => {
    const credentials = extractCredentials(req);
    if (!credentials) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing required headers: Authorization and X-ThreatLocker-Base-URL',
        },
      });
      return;
    }

    try {
      const client = new ThreatLockerClient(credentials);
      const toolName = Array.isArray(req.params.toolName) ? req.params.toolName[0] : req.params.toolName;
      const result = await handleToolCall(client, toolName, req.body || {});
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message },
      });
    }
  });

  // MCP JSON-RPC endpoint for full MCP protocol support
  app.post('/mcp', async (req: Request, res: Response) => {
    const credentials = extractCredentials(req);
    if (!credentials) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Missing required headers: Authorization and X-ThreatLocker-Base-URL' },
        id: req.body?.id || null,
      });
      return;
    }

    const { method, params, id } = req.body;

    try {
      const client = new ThreatLockerClient(credentials);

      if (method === 'tools/list') {
        res.json({
          jsonrpc: '2.0',
          result: {
            tools: [
              computersToolSchema,
              computerGroupsToolSchema,
              applicationsToolSchema,
              policiesToolSchema,
            ],
          },
          id,
        });
        return;
      }

      if (method === 'tools/call') {
        const { name, arguments: args } = params || {};
        const result = await handleToolCall(client, name, args || {});
        res.json({
          jsonrpc: '2.0',
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          },
          id,
        });
        return;
      }

      res.json({
        jsonrpc: '2.0',
        error: { code: -32601, message: `Method not found: ${method}` },
        id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message },
        id,
      });
    }
  });

  app.listen(port, () => {
    console.error(`ThreatLocker MCP server running on http://localhost:${port}`);
    console.error('Endpoints:');
    console.error('  GET  /health      - Health check');
    console.error('  GET  /tools       - List available tools');
    console.error('  POST /tools/:name - Call a tool (requires auth headers)');
    console.error('  POST /mcp         - MCP JSON-RPC endpoint');
  });
}
