import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const systemAuditToolSchema = {
  name: 'system_audit',
  description: 'Query ThreatLocker portal audit logs (user logins, config changes)',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['search', 'health_center'],
        description: 'Action to perform',
      },
      startDate: {
        type: 'string',
        description: 'Start date for search (ISO 8601 UTC)',
      },
      endDate: {
        type: 'string',
        description: 'End date for search (ISO 8601 UTC)',
      },
      username: {
        type: 'string',
        description: 'Filter by username (wildcards supported)',
      },
      auditAction: {
        type: 'string',
        enum: ['Create', 'Delete', 'Logon', 'Modify', 'Read'],
        description: 'Filter by audit action type',
      },
      ipAddress: {
        type: 'string',
        description: 'Filter by IP address',
      },
      effectiveAction: {
        type: 'string',
        enum: ['Denied', 'Permitted'],
        description: 'Filter by effective action',
      },
      details: {
        type: 'string',
        description: 'Filter by details text (wildcards supported)',
      },
      viewChildOrganizations: {
        type: 'boolean',
        description: 'Include child organizations (default: false)',
      },
      objectId: {
        type: 'string',
        description: 'Filter by specific object ID',
      },
      days: {
        type: 'number',
        description: 'Number of days for health_center action (default: 7)',
      },
      searchText: {
        type: 'string',
        description: 'Search text for health_center action',
      },
      pageNumber: {
        type: 'number',
        description: 'Page number (default: 1)',
      },
      pageSize: {
        type: 'number',
        description: 'Page size (default: 25)',
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
    pageNumber = 1,
    pageSize = 25,
  } = input;

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
