import express, { Request, Response } from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
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

// Zod schemas for McpServer tool registration
const computersZodSchema = {
  action: z.enum(['list', 'get', 'checkins']).describe('Action to perform'),
  computerId: z.string().optional().describe('Computer ID (required for get and checkins)'),
  searchText: z.string().optional().describe('Search text for list action'),
  action_filter: z.enum(['Secure', 'Installation', 'Learning', 'MonitorOnly']).optional().describe('Filter by computer mode for list action'),
  computerGroup: z.string().optional().describe('Computer group ID for list action'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Page size (default: 25)'),
  hideHeartbeat: z.boolean().optional().describe('Hide heartbeat entries for checkins action'),
};

const computerGroupsZodSchema = {
  action: z.enum(['list', 'dropdown']).describe('Action to perform'),
  osType: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).optional().describe('OS type: 0=All, 1=Windows, 2=macOS, 3=Linux, 5=Windows XP'),
  includeGlobal: z.boolean().optional().describe('Include global application-permitting group (list action)'),
  includeAllComputers: z.boolean().optional().describe('Include all computers in response (list action)'),
  hideGlobals: z.boolean().optional().describe('Hide global groups (dropdown action)'),
};

const applicationsZodSchema = {
  action: z.enum(['search', 'get', 'research', 'files']).describe('Action to perform'),
  applicationId: z.string().optional().describe('Application ID (required for get, research, and files)'),
  searchText: z.string().optional().describe('Search text for search and files actions'),
  searchBy: z.enum(['app', 'full', 'process', 'hash', 'cert', 'created', 'categories', 'countries']).optional().describe('Field to search by (default: app)'),
  osType: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).optional().describe('OS type: 0=All, 1=Windows, 2=macOS, 3=Linux, 5=Windows XP'),
  category: z.number().optional().describe('Category filter'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Page size (default: 25)'),
};

const policiesZodSchema = {
  action: z.enum(['get', 'list_by_application']).describe('Action to perform'),
  policyId: z.string().optional().describe('Policy ID (required for get)'),
  applicationId: z.string().optional().describe('Application ID (required for list_by_application)'),
  organizationId: z.string().optional().describe('Organization ID (required for list_by_application)'),
  appliesToId: z.string().optional().describe('Computer group ID to filter by'),
  includeDenies: z.boolean().optional().describe('Include deny policies'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Page size (default: 25)'),
};

function createMcpServer(client: ThreatLockerClient): McpServer {
  const server = new McpServer({
    name: 'threatlocker-mcp',
    version: '0.3.0',
  });

  server.tool(
    computersToolSchema.name,
    computersToolSchema.description,
    computersZodSchema,
    async (args) => {
      const result = await handleComputersTool(client, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    computerGroupsToolSchema.name,
    computerGroupsToolSchema.description,
    computerGroupsZodSchema,
    async (args) => {
      const result = await handleComputerGroupsTool(client, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    applicationsToolSchema.name,
    applicationsToolSchema.description,
    applicationsZodSchema,
    async (args) => {
      const result = await handleApplicationsTool(client, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    policiesToolSchema.name,
    policiesToolSchema.description,
    policiesZodSchema,
    async (args) => {
      const result = await handlePoliciesTool(client, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}

export function createHttpServer(port: number): void {
  const app = express();
  app.use(express.json());

  // Health check - no auth required
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', transport: 'http', version: '0.3.0' });
  });

  // List available tools - no auth required
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

  // Direct tool call endpoint (REST API) - requires auth headers per request
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
      const args = req.body || {};

      let result: unknown;
      switch (toolName) {
        case 'computers':
          result = await handleComputersTool(client, args);
          break;
        case 'computer_groups':
          result = await handleComputerGroupsTool(client, args);
          break;
        case 'applications':
          result = await handleApplicationsTool(client, args);
          break;
        case 'policies':
          result = await handlePoliciesTool(client, args);
          break;
        default:
          res.status(400).json({
            success: false,
            error: { code: 'BAD_REQUEST', message: `Unknown tool: ${toolName}` },
          });
          return;
      }
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message },
      });
    }
  });

  // Streamable HTTP MCP endpoint
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

    try {
      const client = new ThreatLockerClient(credentials);
      const server = createMcpServer(client);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message },
          id: req.body?.id || null,
        });
      }
    }
  });

  // GET /mcp - Not supported (no server-initiated messages)
  app.get('/mcp', (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'GET not supported. Use POST to send messages.' },
      id: null,
    });
  });

  // DELETE /mcp - Not supported (stateless, no sessions)
  app.delete('/mcp', (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Sessions not supported in stateless mode.' },
      id: null,
    });
  });

  app.listen(port, () => {
    console.error(`ThreatLocker MCP server running on http://localhost:${port}`);
    console.error('');
    console.error('Streamable HTTP Transport (for Claude Desktop/Code):');
    console.error('  POST /mcp          - MCP JSON-RPC endpoint');
    console.error('');
    console.error('REST API (direct calls):');
    console.error('  GET  /health       - Health check');
    console.error('  GET  /tools        - List available tools');
    console.error('  POST /tools/:name  - Call a tool (requires auth headers)');
  });
}
