#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ThreatLockerClient } from './client.js';
import { computersToolSchema, handleComputersTool } from './tools/computers.js';
import { computerGroupsToolSchema, handleComputerGroupsTool } from './tools/computer-groups.js';
import { applicationsToolSchema, handleApplicationsTool } from './tools/applications.js';
import { policiesToolSchema, handlePoliciesTool } from './tools/policies.js';

const apiKey = process.env.THREATLOCKER_API_KEY;
const instance = process.env.THREATLOCKER_INSTANCE;
const organizationId = process.env.THREATLOCKER_ORG_ID;

if (!apiKey) {
  console.error('THREATLOCKER_API_KEY environment variable is required');
  process.exit(1);
}

if (!instance) {
  console.error('THREATLOCKER_INSTANCE environment variable is required');
  process.exit(1);
}

const client = new ThreatLockerClient({ apiKey, instance, organizationId });

const server = new Server(
  {
    name: 'threatlocker-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    computersToolSchema,
    computerGroupsToolSchema,
    applicationsToolSchema,
    policiesToolSchema,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  let result;
  switch (name) {
    case 'computers':
      result = await handleComputersTool(client, args || {});
      break;
    case 'computer_groups':
      result = await handleComputerGroupsTool(client, args || {});
      break;
    case 'applications':
      result = await handleApplicationsTool(client, args || {});
      break;
    case 'policies':
      result = await handlePoliciesTool(client, args || {});
      break;
    default:
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: `Unknown tool: ${name}` } }) }],
      };
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ThreatLocker MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
