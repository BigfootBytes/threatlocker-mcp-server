#!/usr/bin/env node
import 'dotenv/config';
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
import { actionLogToolSchema, handleActionLogTool } from './tools/action-log.js';
import { approvalRequestsToolSchema, handleApprovalRequestsTool } from './tools/approval-requests.js';
import { organizationsToolSchema, handleOrganizationsTool } from './tools/organizations.js';
import { reportsToolSchema, handleReportsTool } from './tools/reports.js';
import { maintenanceModeToolSchema, handleMaintenanceModeTool } from './tools/maintenance-mode.js';
import { scheduledActionsToolSchema, handleScheduledActionsTool } from './tools/scheduled-actions.js';
import { systemAuditToolSchema, handleSystemAuditTool } from './tools/system-audit.js';
import { tagsToolSchema, handleTagsTool } from './tools/tags.js';
import { storagePoliciesToolSchema, handleStoragePoliciesTool } from './tools/storage-policies.js';
import { networkAccessPoliciesToolSchema, handleNetworkAccessPoliciesTool } from './tools/network-access-policies.js';
import { createHttpServer } from './transports/http.js';
import { VERSION } from './version.js';

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

  const server = new Server(
    {
      name: 'threatlocker-mcp',
      version: VERSION,
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
      actionLogToolSchema,
      approvalRequestsToolSchema,
      organizationsToolSchema,
      reportsToolSchema,
      maintenanceModeToolSchema,
      scheduledActionsToolSchema,
      systemAuditToolSchema,
      tagsToolSchema,
      storagePoliciesToolSchema,
      networkAccessPoliciesToolSchema,
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
      case 'action_log':
        result = await handleActionLogTool(client, args || {});
        break;
      case 'approval_requests':
        result = await handleApprovalRequestsTool(client, args || {});
        break;
      case 'organizations':
        result = await handleOrganizationsTool(client, args || {});
        break;
      case 'reports':
        result = await handleReportsTool(client, args || {});
        break;
      case 'maintenance_mode':
        result = await handleMaintenanceModeTool(client, args || {});
        break;
      case 'scheduled_actions':
        result = await handleScheduledActionsTool(client, args || {});
        break;
      case 'system_audit':
        result = await handleSystemAuditTool(client, args || {});
        break;
      case 'tags':
        result = await handleTagsTool(client, args || {});
        break;
      case 'storage_policies':
        result = await handleStoragePoliciesTool(client, args || {});
        break;
      case 'network_access_policies':
        result = await handleNetworkAccessPoliciesTool(client, args || {});
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
}
