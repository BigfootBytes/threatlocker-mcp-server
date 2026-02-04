import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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

interface SSESession {
  res: Response;
  credentials: ClientCredentials;
}

// Active SSE sessions by session ID
const sseSessions = new Map<string, SSESession>();

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

async function handleMcpMessage(
  credentials: ClientCredentials,
  method: string,
  params: Record<string, unknown> | undefined,
  id: string | number | null
): Promise<object> {
  try {
    const client = new ThreatLockerClient(credentials);

    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'threatlocker-mcp', version: '0.3.0' },
        },
        id,
      };
    }

    if (method === 'notifications/initialized') {
      // No response needed for notifications
      return { jsonrpc: '2.0', result: {}, id };
    }

    if (method === 'tools/list') {
      return {
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
      };
    }

    if (method === 'tools/call') {
      const toolParams = params as { name?: string; arguments?: Record<string, unknown> } | undefined;
      const result = await handleToolCall(client, toolParams?.name || '', toolParams?.arguments || {});
      return {
        jsonrpc: '2.0',
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        },
        id,
      };
    }

    return {
      jsonrpc: '2.0',
      error: { code: -32601, message: `Method not found: ${method}` },
      id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      jsonrpc: '2.0',
      error: { code: -32603, message },
      id,
    };
  }
}

function sendSSEEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
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

  // SSE endpoint for Claude Desktop/Code remote connections
  app.get('/sse', (req: Request, res: Response) => {
    const credentials = extractCredentials(req);
    if (!credentials) {
      res.status(401).json({
        error: 'Missing required headers: Authorization and X-ThreatLocker-Base-URL',
      });
      return;
    }

    // Generate session ID
    const sessionId = crypto.randomUUID();

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Store session
    sseSessions.set(sessionId, { res, credentials });

    // Send endpoint event with session-specific message URL
    sendSSEEvent(res, 'endpoint', `/messages?sessionId=${sessionId}`);

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(':keepalive\n\n');
    }, 30000);

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(keepAlive);
      sseSessions.delete(sessionId);
    });
  });

  // Messages endpoint for SSE clients
  app.post('/messages', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const session = sseSessions.get(sessionId);

    if (!session) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid or expired session. Connect to /sse first.' },
        id: req.body?.id || null,
      });
      return;
    }

    const { method, params, id } = req.body;
    const response = await handleMcpMessage(session.credentials, method, params, id);

    // Send response via SSE
    sendSSEEvent(session.res, 'message', response);

    // Also send HTTP response for acknowledgment
    res.status(202).json({ status: 'accepted' });
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

  // Direct MCP JSON-RPC endpoint (REST API) - requires auth headers per request
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
    const response = await handleMcpMessage(credentials, method, params, id);
    res.json(response);
  });

  app.listen(port, () => {
    console.error(`ThreatLocker MCP server running on http://localhost:${port}`);
    console.error('');
    console.error('SSE Transport (for Claude Desktop/Code):');
    console.error('  GET  /sse          - SSE connection (requires auth headers)');
    console.error('  POST /messages     - Send messages (via session)');
    console.error('');
    console.error('REST API (direct calls):');
    console.error('  GET  /health       - Health check');
    console.error('  GET  /tools        - List available tools');
    console.error('  POST /tools/:name  - Call a tool (requires auth headers)');
    console.error('  POST /mcp          - MCP JSON-RPC (requires auth headers)');
  });
}
