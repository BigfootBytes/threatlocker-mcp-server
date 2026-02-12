import { randomUUID } from 'node:crypto';
import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ThreatLockerClient } from '../client.js';
import { toolsByName, allToolsWithSchema } from '../tools/registry.js';
import { createMcpServer, CHARACTER_LIMIT, LogFn } from '../server.js';
import { formatAsMarkdown } from '../formatters.js';
import { VERSION } from '../version.js';

const responseFormatJsonSchema = {
  type: 'string',
  enum: ['json', 'markdown'],
  default: 'json',
  description: 'Output format: json (default, structured) or markdown (human-readable)',
};

interface ClientCredentials {
  apiKey: string;
  baseUrl: string;
  organizationId?: string;
}

interface SSESession {
  transport: SSEServerTransport;
  server: McpServer;
}

// Active SSE sessions by session ID
const sseSessions = new Map<string, SSESession>();

export function extractCredentials(req: Request): ClientCredentials | null {
  let apiKey = req.headers['authorization'] as string;
  const baseUrl = req.headers['x-threatlocker-base-url'] as string;
  const organizationId = req.headers['x-threatlocker-org-id'] as string | undefined;

  if (!apiKey || !baseUrl) {
    return null;
  }

  // Strip "Bearer " prefix if present (Claude Desktop may add it automatically)
  const bearerMatch = apiKey.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) {
    apiKey = bearerMatch[1];
  }

  return { apiKey, baseUrl, organizationId };
}

export function validateOrigin(req: Request): boolean {
  const origin = req.headers['origin'];

  // No origin header (non-browser clients) - allow
  if (origin === undefined) {
    return true;
  }

  // Check against allowed origins from environment
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];

  // If no allowed origins configured, reject all browser requests for safety
  if (allowedOrigins.length === 0) {
    return false;
  }

  return allowedOrigins.includes(origin);
}

// Log levels: ERROR=0, INFO=1, DEBUG=2
const LOG_LEVELS = { ERROR: 0, INFO: 1, DEBUG: 2 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

function getLogLevel(): number {
  const level = (process.env.LOG_LEVEL || 'INFO').toUpperCase() as LogLevel;
  return LOG_LEVELS[level] ?? LOG_LEVELS.INFO;
}

// Simple logger with timestamps
function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (LOG_LEVELS[level] > getLogLevel()) return;
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  console.error(`[${timestamp}] [${level}] ${message}${dataStr}`);
}

export function createApp(): ReturnType<typeof express> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Rate limiting for authenticated endpoints
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // 100 requests per window per IP
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
    },
  });
  app.use('/tools', apiLimiter);
  app.use('/mcp', apiLimiter);
  app.use('/sse', apiLimiter);
  app.use('/messages', apiLimiter);

  // Rate limiting for unauthenticated metadata endpoints
  const metadataLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  app.use('/health', metadataLimiter);

  // CORS response headers for allowed browser origins
  app.use((req, res, next) => {
    const origin = req.headers['origin'];
    if (origin && validateOrigin(req)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-ThreatLocker-Base-URL, X-ThreatLocker-Org-ID, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Request logging middleware
  app.use((req, _res, next) => {
    const org = req.headers['x-threatlocker-org-id'] as string | undefined;
    log('INFO', `${req.method} ${req.path}`, {
      org: org ? org.substring(0, 8) + '...' : undefined,
      hasAuth: !!req.headers['authorization'],
    });
    next();
  });

  // Health check - no auth required
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      transports: ['sse', 'streamable-http'],
      protocolVersion: '2025-03-26',
      version: VERSION
    });
  });

  // List available tools - no auth required
  app.get('/tools', (_req, res) => {
    res.json({
      tools: allToolsWithSchema.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: {
          ...t.inputSchema,
          properties: {
            ...(t.inputSchema.properties as Record<string, unknown>),
            response_format: responseFormatJsonSchema,
          },
        },
        outputSchema: t.outputSchema,
      })),
    });
  });

  // Direct tool call endpoint (REST API) - requires auth headers per request
  app.post('/tools/:toolName', async (req: Request, res: Response) => {
    // DNS rebinding protection
    if (!validateOrigin(req)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Origin not allowed' },
      });
      return;
    }

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

    const toolName = Array.isArray(req.params.toolName) ? req.params.toolName[0] : req.params.toolName;

    try {
      const client = new ThreatLockerClient(credentials);
      const args = req.body || {};

      const tool = toolsByName.get(toolName);
      if (!tool) {
        log('DEBUG', 'REST API unknown tool', { tool: toolName });
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: `Unknown tool: ${toolName}` },
        });
        return;
      }

      // Validate request body against Zod schema (REST API bypasses MCP SDK validation)
      const zodObject = z.object(tool.zodSchema).passthrough();
      const parsed = zodObject.safeParse(args);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: parsed.error.issues.map((e: z.ZodIssue) => e.message).join('; ') },
        });
        return;
      }

      const { response_format: responseFormat, ...toolArgs } = args;
      const result = await tool.handler(client, toolArgs);

      if (responseFormat === 'markdown') {
        let text = formatAsMarkdown(result);
        if (text.length > CHARACTER_LIMIT) {
          text = text.slice(0, CHARACTER_LIMIT) +
            '\n\n---\n**Output truncated** (exceeded 50,000 characters). Use a smaller `pageSize` or add filters to narrow results.';
        }
        res.type('text/markdown').send(text);
      } else {
        res.json(result);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('ERROR', 'REST API tool failed', { tool: toolName, error: message });
      res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message },
      });
    }
  });

  // SSE endpoint for Claude Desktop/Code remote connections (legacy)
  app.get('/sse', async (req: Request, res: Response) => {
    // DNS rebinding protection
    if (!validateOrigin(req)) {
      res.status(403).json({
        error: 'Origin not allowed',
      });
      return;
    }

    const credentials = extractCredentials(req);
    if (!credentials) {
      res.status(401).json({
        error: 'Missing required headers: Authorization and X-ThreatLocker-Base-URL',
      });
      return;
    }

    try {
      const client = new ThreatLockerClient(credentials);
      const server = createMcpServer(client, log as LogFn);
      const transport = new SSEServerTransport('/messages', res);

      // Generate cryptographically secure session ID
      const sessionId = randomUUID();
      sseSessions.set(sessionId, { transport, server });
      log('INFO', 'SSE session connected', { sessionId, activeSessions: sseSessions.size });

      // Clean up on disconnect
      res.on('close', () => {
        sseSessions.delete(sessionId);
        log('INFO', 'SSE session disconnected', { sessionId, activeSessions: sseSessions.size });
      });

      await server.connect(transport);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('ERROR', 'SSE connection failed', { error: message });
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      }
    }
  });

  // Messages endpoint for SSE clients
  app.post('/messages', async (req: Request, res: Response) => {
    // Find the session - SSEServerTransport sends sessionId as query param
    const sessionId = req.query.sessionId as string;

    // If no sessionId provided, try to find a session (backwards compatibility)
    let session: SSESession | undefined;
    if (sessionId) {
      session = sseSessions.get(sessionId);
    } else if (sseSessions.size === 1) {
      // If only one session, use it (simple case)
      session = sseSessions.values().next().value;
    }

    if (!session) {
      log('DEBUG', 'SSE message rejected - no session', { sessionId });
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid or expired session. Connect to /sse first.' },
        id: req.body?.id || null,
      });
      return;
    }

    const method = req.body?.method;
    const toolName = req.body?.params?.name;
    log('DEBUG', 'SSE message', { sessionId, method, tool: toolName });

    try {
      await session.transport.handlePostMessage(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('ERROR', 'SSE message failed', { sessionId, method, error: message });
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message },
          id: req.body?.id || null,
        });
      }
    }
  });

  // Streamable HTTP MCP endpoint
  app.post('/mcp', async (req: Request, res: Response) => {
    // DNS rebinding protection
    if (!validateOrigin(req)) {
      res.status(403).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Origin not allowed' },
        id: req.body?.id || null,
      });
      return;
    }

    const credentials = extractCredentials(req);
    if (!credentials) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Missing required headers: Authorization and X-ThreatLocker-Base-URL' },
        id: req.body?.id || null,
      });
      return;
    }

    const method = req.body?.method;
    const toolName = req.body?.params?.name;
    log('DEBUG', 'MCP request', { method, tool: toolName });

    try {
      const client = new ThreatLockerClient(credentials);
      const server = createMcpServer(client, log as LogFn);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
        enableJsonResponse: true,
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('ERROR', 'MCP request failed', { method, tool: toolName, error: message });
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

  return app;
}

export function createHttpServer(port: number): void {
  const app = createApp();
  app.listen(port, () => {
    console.error(`ThreatLocker MCP server running on http://localhost:${port}`);
    console.error('');
    console.error('SSE Transport (for Claude Desktop):');
    console.error('  GET  /sse          - SSE connection (requires auth headers)');
    console.error('  POST /messages     - Messages from SSE clients');
    console.error('');
    console.error('Streamable HTTP Transport:');
    console.error('  POST /mcp          - MCP JSON-RPC endpoint');
    console.error('');
    console.error('REST API (direct calls):');
    console.error('  GET  /health       - Health check');
    console.error('  GET  /tools        - List available tools');
    console.error('  POST /tools/:name  - Call a tool (requires auth headers)');
  });
}
