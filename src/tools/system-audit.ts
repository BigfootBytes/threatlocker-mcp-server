import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination } from '../types/responses.js';

export const systemAuditToolSchema = {
  name: 'system_audit',
  description: `Query ThreatLocker portal audit logs.

System audit tracks administrator actions in the ThreatLocker portal: logins, policy changes, approvals, configuration modifications. This is different from action_log which tracks endpoint events.

Common workflows:
- Find all logins in date range: action=search, startDate="...", endDate="...", auditAction=Logon
- Find failed login attempts: action=search, ..., auditAction=Logon, effectiveAction=Denied
- Find changes by a specific admin: action=search, ..., username="admin@company.com"
- Find policy modifications: action=search, ..., auditAction=Modify, details="*policy*"
- Get health center dashboard: action=health_center, days=7
- Search health center by location: action=health_center, searchText="lat:X&long:Y"

Audit actions: Create (new objects), Delete (removals), Logon (portal access), Modify (changes), Read (views)

Related tools: action_log (endpoint events, not portal events), organizations (filter by org)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['search', 'health_center'],
        description: 'search=query audit logs, health_center=admin activity dashboard',
      },
      startDate: {
        type: 'string',
        description: 'Start of date range (required for search). ISO 8601 UTC: 2025-01-01T00:00:00Z',
      },
      endDate: {
        type: 'string',
        description: 'End of date range (required for search). ISO 8601 UTC: 2025-01-31T23:59:59Z',
      },
      username: {
        type: 'string',
        description: 'Filter by admin username/email. Supports wildcards: "*@company.com"',
      },
      auditAction: {
        type: 'string',
        enum: ['Create', 'Delete', 'Logon', 'Modify', 'Read'],
        description: 'Filter by action type: Create, Delete, Logon (portal access), Modify (changes), Read (views)',
      },
      ipAddress: {
        type: 'string',
        description: 'Filter by source IP address of the admin.',
      },
      effectiveAction: {
        type: 'string',
        enum: ['Denied', 'Permitted'],
        description: 'Filter by result: Denied (failed/blocked), Permitted (successful)',
      },
      details: {
        type: 'string',
        description: 'Search in audit details text. Supports wildcards: "*policy*", "*application*"',
      },
      viewChildOrganizations: {
        type: 'boolean',
        description: 'Include audit logs from child organizations (MSP/enterprise view).',
      },
      objectId: {
        type: 'string',
        description: 'Filter to actions on a specific object (policy, application, etc.) by GUID.',
      },
      days: {
        type: 'number',
        description: 'Lookback period for health_center (default: 7 days).',
      },
      searchText: {
        type: 'string',
        description: 'Search text for health_center. Supports location: "lat:X&long:Y"',
      },
      pageNumber: {
        type: 'number',
        description: 'Page number (default: 1)',
      },
      pageSize: {
        type: 'number',
        description: 'Results per page (default: 25)',
      },
    },
    required: ['action'],
  },
};

interface SystemAuditInput {
  action?: 'search' | 'health_center';
  startDate?: string;
  endDate?: string;
  username?: string;
  auditAction?: string;
  ipAddress?: string;
  effectiveAction?: string;
  details?: string;
  viewChildOrganizations?: boolean;
  objectId?: string;
  days?: number;
  searchText?: string;
  pageNumber?: number;
  pageSize?: number;
}

export async function handleSystemAuditTool(
  client: ThreatLockerClient,
  input: SystemAuditInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    startDate,
    endDate,
    username = '',
    auditAction = '',
    ipAddress = '',
    effectiveAction = '',
    details = '',
    viewChildOrganizations = false,
    objectId,
    days = 7,
    searchText = '',
  } = input;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber, input.pageSize);

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'search':
      if (!startDate || !endDate) {
        return errorResponse('BAD_REQUEST', 'startDate and endDate are required for search action');
      }
      return client.post(
        'SystemAudit/SystemAuditGetByParameters',
        {
          startDate,
          endDate,
          pageSize,
          pageNumber,
          username,
          action: auditAction,
          ipAddress,
          effectiveAction,
          details,
          viewChildOrganizations,
          objectId: objectId || '',
        },
        extractPaginationFromHeaders
      );

    case 'health_center':
      return client.post(
        'SystemAudit/SystemAuditGetForHealthCenter',
        {
          days,
          isLoggedIn: true,
          pageSize,
          pageNumber,
          searchText,
        },
        extractPaginationFromHeaders
      );

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
