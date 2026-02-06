import express, { Request, Response } from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ThreatLockerClient } from '../client.js';
import { computersToolSchema, handleComputersTool } from '../tools/computers.js';
import { computerGroupsToolSchema, handleComputerGroupsTool } from '../tools/computer-groups.js';
import { applicationsToolSchema, handleApplicationsTool } from '../tools/applications.js';
import { policiesToolSchema, handlePoliciesTool } from '../tools/policies.js';
import { actionLogToolSchema, handleActionLogTool } from '../tools/action-log.js';
import { approvalRequestsToolSchema, handleApprovalRequestsTool } from '../tools/approval-requests.js';
import { organizationsToolSchema, handleOrganizationsTool } from '../tools/organizations.js';
import { reportsToolSchema, handleReportsTool } from '../tools/reports.js';
import { maintenanceModeToolSchema, handleMaintenanceModeTool } from '../tools/maintenance-mode.js';
import { scheduledActionsToolSchema, handleScheduledActionsTool } from '../tools/scheduled-actions.js';
import { systemAuditToolSchema, handleSystemAuditTool } from '../tools/system-audit.js';
import { tagsToolSchema, handleTagsTool } from '../tools/tags.js';
import { VERSION } from '../version.js';

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

function extractCredentials(req: Request): ClientCredentials | null {
  let apiKey = req.headers['authorization'] as string;
  const baseUrl = req.headers['x-threatlocker-base-url'] as string;
  const organizationId = req.headers['x-threatlocker-org-id'] as string | undefined;

  if (!apiKey || !baseUrl) {
    return null;
  }

  // Strip "Bearer " prefix if present (Claude Desktop may add it automatically)
  if (apiKey.toLowerCase().startsWith('bearer ')) {
    apiKey = apiKey.substring(7);
  }

  return { apiKey, baseUrl, organizationId };
}

function validateOrigin(req: Request): boolean {
  const origin = req.headers['origin'];

  // No origin header (non-browser clients) - allow
  if (origin === undefined) {
    return true;
  }

  // Null origin (local files, sandboxed iframes) - allow
  if (origin === 'null') {
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

// Zod schemas for McpServer tool registration
const computersZodSchema = {
  action: z.enum(['list', 'get', 'checkins', 'get_install_info']).describe('Action to perform'),
  computerId: z.string().optional().describe('Computer ID (required for get and checkins)'),
  searchText: z.string().optional().describe('Search text for list action'),
  searchBy: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional().describe('Field to search by: 1=Computer/Asset Name, 2=Username, 3=Computer Group Name, 4=Last Check-in IP, 5=Organization Name'),
  action_filter: z.enum(['Secure', 'Installation', 'Learning', 'MonitorOnly']).optional().describe('Filter by computer mode for list action'),
  computerGroup: z.string().optional().describe('Computer group ID for list action'),
  orderBy: z.enum(['computername', 'group', 'action', 'lastcheckin', 'computerinstalldate', 'deniedcountthreedays', 'updatechannel', 'threatlockerversion']).optional().describe('Field to sort by (default: computername)'),
  isAscending: z.boolean().optional().describe('Sort ascending (default: true)'),
  childOrganizations: z.boolean().optional().describe('Include child organizations (default: false)'),
  kindOfAction: z.enum(['Computer Mode', 'TamperProtectionDisabled', 'NeedsReview', 'ReadyToSecure', 'BaselineNotUploaded', 'Update Channel']).optional().describe('Additional filter for computer state'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Page size (default: 25)'),
  hideHeartbeat: z.boolean().optional().describe('Hide heartbeat entries for checkins action'),
};

const computerGroupsZodSchema = {
  action: z.enum(['list', 'dropdown', 'dropdown_with_org', 'get_for_permit', 'get_by_install_key']).describe('Action to perform'),
  osType: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).optional().describe('OS type: 0=All, 1=Windows, 2=macOS, 3=Linux, 5=Windows XP'),
  includeGlobal: z.boolean().optional().describe('Include global application-permitting group (list action)'),
  includeAllComputers: z.boolean().optional().describe('Include all computers in response (list action)'),
  includeOrganizations: z.boolean().optional().describe('Include accessible organizations (list action)'),
  includeParentGroups: z.boolean().optional().describe('Show parent computer groups (list action)'),
  includeLoggedInObjects: z.boolean().optional().describe('Add contextual path labels (list action)'),
  includeDnsServers: z.boolean().optional().describe('Include DNS servers (list action)'),
  includeIngestors: z.boolean().optional().describe('Include ingestors (list action)'),
  includeAccessDevices: z.boolean().optional().describe('Include access devices (list action)'),
  includeRemovedComputers: z.boolean().optional().describe('Include removed computers (list action)'),
  computerGroupId: z.string().optional().describe('Filter by specific computer group ID (list action)'),
  hideGlobals: z.boolean().optional().describe('Hide global groups (dropdown action)'),
  includeAvailableOrganizations: z.boolean().optional().describe('Include child and parent organizations (dropdown_with_org action)'),
  includeAllPolicies: z.boolean().optional().describe('Include all policies attached to groups (list action)'),
  installKey: z.string().optional().describe('24-character install key (required for get_by_install_key)'),
};

const applicationsZodSchema = {
  action: z.enum(['search', 'get', 'research', 'files', 'match', 'get_for_maintenance', 'get_for_network_policy']).describe('Action to perform'),
  applicationId: z.string().optional().describe('Application ID (required for get, research, files, get_for_network_policy)'),
  searchText: z.string().optional().describe('Search text for search and files actions'),
  searchBy: z.enum(['app', 'full', 'process', 'hash', 'cert', 'created', 'categories', 'countries']).optional().describe('Field to search by (default: app)'),
  osType: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).optional().describe('OS type: 0=All, 1=Windows, 2=macOS, 3=Linux, 5=Windows XP'),
  category: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional().describe('Category: 0=All, 1=My Applications (Custom), 2=Built-In'),
  orderBy: z.enum(['name', 'date-created', 'review-rating', 'computer-count', 'policy']).optional().describe('Field to sort by (default: name)'),
  isAscending: z.boolean().optional().describe('Sort ascending (default: true)'),
  includeChildOrganizations: z.boolean().optional().describe('Include child organization applications (default: false)'),
  isHidden: z.boolean().optional().describe('Include hidden/temporary applications (default: false)'),
  permittedApplications: z.boolean().optional().describe('Only show apps with active permit policies (default: false)'),
  countries: z.array(z.string()).optional().describe('ISO country codes to filter by (use with searchBy=countries)'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Page size (default: 25)'),
  hash: z.string().optional().describe('SHA256 hash for match action'),
  path: z.string().optional().describe('Full file path for match action'),
  processPath: z.string().optional().describe('Process path for match action'),
  cert: z.string().optional().describe('Certificate subject for match action'),
  certSha: z.string().optional().describe('Certificate SHA for match action'),
  createdBy: z.string().optional().describe('Created by path for match action'),
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

const actionLogZodSchema = {
  action: z.enum(['search', 'get', 'file_history', 'get_file_download', 'get_policy_conditions', 'get_testing_details']).describe('Action to perform'),
  startDate: z.string().optional().describe('Start date for search (ISO 8601 UTC)'),
  endDate: z.string().optional().describe('End date for search (ISO 8601 UTC)'),
  actionId: z.union([z.literal(1), z.literal(2), z.literal(99)]).optional().describe('Filter by action: 1=Permit, 2=Deny, 99=Any Deny'),
  actionType: z.enum(['execute', 'install', 'network', 'registry', 'read', 'write', 'move', 'delete', 'baseline', 'powershell', 'elevate', 'configuration', 'dns']).optional().describe('Filter by action type'),
  hostname: z.string().optional().describe('Filter by hostname (wildcards supported)'),
  actionLogId: z.string().optional().describe('Action log ID (required for get, get_file_download, get_policy_conditions, get_testing_details)'),
  fullPath: z.string().optional().describe('File path for search filter or file_history (wildcards supported)'),
  computerId: z.string().optional().describe('Computer ID to scope file_history'),
  showChildOrganizations: z.boolean().optional().describe('Include child organization logs (default: false)'),
  onlyTrueDenies: z.boolean().optional().describe('Filter to actual denies only (default: false)'),
  groupBys: z.array(z.number()).optional().describe('Group by: 1=Username, 2=Process Path, 6=Policy Name, 8=App Name, 9=Action Type, 17=Asset Name, 70=Risk Score'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Page size (default: 25)'),
};

const approvalRequestsZodSchema = {
  action: z.enum(['list', 'get', 'count', 'get_file_download_details', 'get_permit_application', 'get_storage_approval']).describe('Action to perform'),
  approvalRequestId: z.string().optional().describe('Approval request ID (required for get)'),
  statusId: z.union([z.literal(1), z.literal(4), z.literal(6), z.literal(10), z.literal(12), z.literal(13), z.literal(16)]).optional().describe('Filter by status'),
  searchText: z.string().optional().describe('Filter by text'),
  orderBy: z.enum(['username', 'devicetype', 'actiontype', 'path', 'actiondate', 'datetime']).optional().describe('Field to order by'),
  isAscending: z.boolean().optional().describe('Sort ascending (default: true)'),
  showChildOrganizations: z.boolean().optional().describe('Include child organizations (default: false)'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Page size (default: 25)'),
};

const organizationsZodSchema = {
  action: z.enum(['list_children', 'get_auth_key', 'get_for_move_computers']).describe('Action to perform'),
  searchText: z.string().optional().describe('Filter by name (for list_children)'),
  includeAllChildren: z.boolean().optional().describe('Include nested children (default: false)'),
  orderBy: z.enum(['billingMethod', 'businessClassificationName', 'dateAdded', 'name']).optional().describe('Field to order by'),
  isAscending: z.boolean().optional().describe('Sort ascending (default: true)'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Page size (default: 25)'),
};

const reportsZodSchema = {
  action: z.enum(['list', 'get_data']).describe('Action to perform'),
  reportId: z.string().optional().describe('Report ID (required for get_data action)'),
};

const maintenanceModeZodSchema = {
  action: z.enum(['get_history']).describe('Action to perform'),
  computerId: z.string().describe('Computer ID (required)'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Page size (default: 25)'),
};

const scheduledActionsZodSchema = {
  action: z.enum(['list', 'search', 'get', 'get_applies_to']).describe('Action to perform'),
  scheduledActionId: z.string().optional().describe('Scheduled action ID (required for get)'),
  organizationIds: z.array(z.string()).optional().describe('Filter by organization IDs'),
  computerGroupIds: z.array(z.string()).optional().describe('Filter by computer group IDs'),
  orderBy: z.enum(['scheduleddatetime', 'computername', 'computergroupname', 'organizationname']).optional().describe('Field to sort by'),
  isAscending: z.boolean().optional().describe('Sort ascending (default: true)'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Page size (default: 25)'),
};

const systemAuditZodSchema = {
  action: z.enum(['search', 'health_center']).describe('Action to perform'),
  startDate: z.string().optional().describe('Start date (ISO 8601 UTC)'),
  endDate: z.string().optional().describe('End date (ISO 8601 UTC)'),
  username: z.string().optional().describe('Filter by username (wildcards supported)'),
  auditAction: z.enum(['Create', 'Delete', 'Logon', 'Modify', 'Read']).optional().describe('Filter by audit action type'),
  ipAddress: z.string().optional().describe('Filter by IP address'),
  effectiveAction: z.enum(['Denied', 'Permitted']).optional().describe('Filter by effective action'),
  details: z.string().optional().describe('Filter by details text (wildcards supported)'),
  viewChildOrganizations: z.boolean().optional().describe('Include child organizations (default: false)'),
  objectId: z.string().optional().describe('Filter by specific object ID'),
  days: z.number().optional().describe('Number of days for health_center (default: 7)'),
  searchText: z.string().optional().describe('Search text for health_center'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Page size (default: 25)'),
};

const tagsZodSchema = {
  action: z.enum(['get', 'dropdown']).describe('Action to perform'),
  tagId: z.string().optional().describe('Tag ID (required for get)'),
  includeBuiltIns: z.boolean().optional().describe('Include ThreatLocker built-in tags (default: false)'),
  tagType: z.number().optional().describe('Tag type filter (default: 1)'),
  includeNetworkTagInMaster: z.boolean().optional().describe('Include network tags in master (default: true)'),
};

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

function createMcpServer(client: ThreatLockerClient): McpServer {
  const server = new McpServer({
    name: 'threatlocker-mcp',
    version: VERSION,
  });

  server.tool(
    computersToolSchema.name,
    computersToolSchema.description,
    computersZodSchema,
    async (args) => {
      log('DEBUG', 'Tool call: computers', { args, baseUrl: client.baseUrl });
      const result = await handleComputersTool(client, args);
      if (!result.success) {
        log('ERROR', 'Tool failed: computers', { error: result.error });
      } else {
        const count = Array.isArray(result.data) ? result.data.length : 1;
        log('DEBUG', 'Tool success: computers', { resultCount: count, pagination: result.pagination });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    computerGroupsToolSchema.name,
    computerGroupsToolSchema.description,
    computerGroupsZodSchema,
    async (args) => {
      log('DEBUG', 'Tool call: computer_groups', { args, baseUrl: client.baseUrl });
      const result = await handleComputerGroupsTool(client, args);
      if (!result.success) {
        log('ERROR', 'Tool failed: computer_groups', { error: result.error });
      } else {
        const count = Array.isArray(result.data) ? result.data.length : 1;
        log('DEBUG', 'Tool success: computer_groups', { resultCount: count });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    applicationsToolSchema.name,
    applicationsToolSchema.description,
    applicationsZodSchema,
    async (args) => {
      log('DEBUG', 'Tool call: applications', { args, baseUrl: client.baseUrl });
      const result = await handleApplicationsTool(client, args);
      if (!result.success) {
        log('ERROR', 'Tool failed: applications', { error: result.error });
      } else {
        const count = Array.isArray(result.data) ? result.data.length : 1;
        log('DEBUG', 'Tool success: applications', { resultCount: count, pagination: result.pagination });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    policiesToolSchema.name,
    policiesToolSchema.description,
    policiesZodSchema,
    async (args) => {
      log('DEBUG', 'Tool call: policies', { args, baseUrl: client.baseUrl });
      const result = await handlePoliciesTool(client, args);
      if (!result.success) {
        log('ERROR', 'Tool failed: policies', { error: result.error });
      } else {
        const count = Array.isArray(result.data) ? result.data.length : 1;
        log('DEBUG', 'Tool success: policies', { resultCount: count, pagination: result.pagination });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    actionLogToolSchema.name,
    actionLogToolSchema.description,
    actionLogZodSchema,
    async (args) => {
      log('DEBUG', 'Tool call: action_log', { args, baseUrl: client.baseUrl });
      const result = await handleActionLogTool(client, args);
      if (!result.success) {
        log('ERROR', 'Tool failed: action_log', { error: result.error });
      } else {
        const count = Array.isArray(result.data) ? result.data.length : 1;
        log('DEBUG', 'Tool success: action_log', { resultCount: count, pagination: result.pagination });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    approvalRequestsToolSchema.name,
    approvalRequestsToolSchema.description,
    approvalRequestsZodSchema,
    async (args) => {
      log('DEBUG', 'Tool call: approval_requests', { args, baseUrl: client.baseUrl });
      const result = await handleApprovalRequestsTool(client, args);
      if (!result.success) {
        log('ERROR', 'Tool failed: approval_requests', { error: result.error });
      } else {
        const count = Array.isArray(result.data) ? result.data.length : 1;
        log('DEBUG', 'Tool success: approval_requests', { resultCount: count, pagination: result.pagination });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    organizationsToolSchema.name,
    organizationsToolSchema.description,
    organizationsZodSchema,
    async (args) => {
      log('DEBUG', 'Tool call: organizations', { args, baseUrl: client.baseUrl });
      const result = await handleOrganizationsTool(client, args);
      if (!result.success) {
        log('ERROR', 'Tool failed: organizations', { error: result.error });
      } else {
        const count = Array.isArray(result.data) ? result.data.length : 1;
        log('DEBUG', 'Tool success: organizations', { resultCount: count, pagination: result.pagination });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    reportsToolSchema.name,
    reportsToolSchema.description,
    reportsZodSchema,
    async (args) => {
      log('DEBUG', 'Tool call: reports', { args, baseUrl: client.baseUrl });
      const result = await handleReportsTool(client, args);
      if (!result.success) {
        log('ERROR', 'Tool failed: reports', { error: result.error });
      } else {
        const count = Array.isArray(result.data) ? result.data.length : 1;
        log('DEBUG', 'Tool success: reports', { resultCount: count });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    maintenanceModeToolSchema.name,
    maintenanceModeToolSchema.description,
    maintenanceModeZodSchema,
    async (args) => {
      log('DEBUG', 'Tool call: maintenance_mode', { args, baseUrl: client.baseUrl });
      const result = await handleMaintenanceModeTool(client, args);
      if (!result.success) {
        log('ERROR', 'Tool failed: maintenance_mode', { error: result.error });
      } else {
        const count = Array.isArray(result.data) ? result.data.length : 1;
        log('DEBUG', 'Tool success: maintenance_mode', { resultCount: count });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    scheduledActionsToolSchema.name,
    scheduledActionsToolSchema.description,
    scheduledActionsZodSchema,
    async (args) => {
      log('DEBUG', 'Tool call: scheduled_actions', { args, baseUrl: client.baseUrl });
      const result = await handleScheduledActionsTool(client, args);
      if (!result.success) {
        log('ERROR', 'Tool failed: scheduled_actions', { error: result.error });
      } else {
        const count = Array.isArray(result.data) ? result.data.length : 1;
        log('DEBUG', 'Tool success: scheduled_actions', { resultCount: count, pagination: result.pagination });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    systemAuditToolSchema.name,
    systemAuditToolSchema.description,
    systemAuditZodSchema,
    async (args) => {
      log('DEBUG', 'Tool call: system_audit', { args, baseUrl: client.baseUrl });
      const result = await handleSystemAuditTool(client, args);
      if (!result.success) {
        log('ERROR', 'Tool failed: system_audit', { error: result.error });
      } else {
        const count = Array.isArray(result.data) ? result.data.length : 1;
        log('DEBUG', 'Tool success: system_audit', { resultCount: count, pagination: result.pagination });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    tagsToolSchema.name,
    tagsToolSchema.description,
    tagsZodSchema,
    async (args) => {
      log('DEBUG', 'Tool call: tags', { args, baseUrl: client.baseUrl });
      const result = await handleTagsTool(client, args);
      if (!result.success) {
        log('ERROR', 'Tool failed: tags', { error: result.error });
      } else {
        const count = Array.isArray(result.data) ? result.data.length : 1;
        log('DEBUG', 'Tool success: tags', { resultCount: count });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}

export function createHttpServer(port: number): void {
  const app = express();
  app.use(express.json());

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
      tools: [
        computersToolSchema,
        computerGroupsToolSchema,
        applicationsToolSchema,
        policiesToolSchema,
        actionLogToolSchema,
        approvalRequestsToolSchema,
        organizationsToolSchema,
        reportsToolSchema,
      ],
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
        case 'action_log':
          result = await handleActionLogTool(client, args);
          break;
        case 'approval_requests':
          result = await handleApprovalRequestsTool(client, args);
          break;
        case 'organizations':
          result = await handleOrganizationsTool(client, args);
          break;
        case 'reports':
          result = await handleReportsTool(client, args);
          break;
        case 'maintenance_mode':
          result = await handleMaintenanceModeTool(client, args);
          break;
        case 'scheduled_actions':
          result = await handleScheduledActionsTool(client, args);
          break;
        case 'system_audit':
          result = await handleSystemAuditTool(client, args);
          break;
        case 'tags':
          result = await handleTagsTool(client, args);
          break;
        default:
          log('DEBUG', 'REST API unknown tool', { tool: toolName });
          res.status(400).json({
            success: false,
            error: { code: 'BAD_REQUEST', message: `Unknown tool: ${toolName}` },
          });
          return;
      }
      res.json(result);
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
      const server = createMcpServer(client);
      const transport = new SSEServerTransport('/messages', res);

      // Generate session ID from transport
      const sessionId = Math.random().toString(36).substring(2, 15);
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
      const server = createMcpServer(client);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
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
