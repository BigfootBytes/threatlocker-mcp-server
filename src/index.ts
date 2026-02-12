#!/usr/bin/env node
import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { ThreatLockerClient } from './client.js';
import { createMcpServer } from './server.js';
import { createHttpServer } from './transports/http.js';

// Parse CLI arguments
const args = process.argv.slice(2);
const hasHttpFlag = args.includes('--http');
const hasStdioFlag = args.includes('--stdio');
const portArg = args.find(arg => arg.startsWith('--port='));
const cliPort = portArg ? parseInt(portArg.split('=')[1], 10) : undefined;

// Determine transport mode (CLI flags override env)
function getTransportMode(): 'stdio' | 'http' {
  if (hasHttpFlag) return 'http';
  if (hasStdioFlag) return 'stdio';
  return (process.env.TRANSPORT?.toLowerCase() === 'http') ? 'http' : 'stdio';
}

// Determine port (CLI overrides env)
function getPort(): number {
  if (cliPort) return cliPort;
  return parseInt(process.env.PORT || '8080', 10);
}

const transportMode = getTransportMode();

if (transportMode === 'http') {
  // HTTP mode - credentials passed per-request, no env validation needed
  const port = getPort();
  createHttpServer(port);
} else {
  // Stdio mode - credentials from environment
  const apiKey = process.env.THREATLOCKER_API_KEY;
  const baseUrl = process.env.THREATLOCKER_BASE_URL;
  const organizationId = process.env.THREATLOCKER_ORG_ID;

  if (!apiKey) {
    console.error('THREATLOCKER_API_KEY environment variable is required for stdio mode');
    process.exit(1);
  }

  if (!baseUrl) {
    console.error('THREATLOCKER_BASE_URL environment variable is required for stdio mode');
    process.exit(1);
  }

  const client = new ThreatLockerClient({ apiKey, baseUrl, organizationId });
  const server = createMcpServer(client);

  async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('ThreatLocker MCP server running on stdio');
  }

  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
