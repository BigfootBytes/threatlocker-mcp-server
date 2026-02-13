import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateDateRange, validateGuid } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof systemAuditZodSchema>>;

export async function handleSystemAuditTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
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
  } = input as ToolInput;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber as number | undefined, input.pageSize as number | undefined);

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'search': {
      if (!startDate || !endDate) {
        return errorResponse('BAD_REQUEST', 'startDate and endDate are required for search action');
      }
      const dateError = validateDateRange(startDate, endDate);
      if (dateError) return dateError;
      if (objectId) {
        const guidError = validateGuid(objectId, 'objectId');
        if (guidError) return guidError;
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
    }

    case 'health_center': {
      const clampedDays = Math.max(1, Math.min(Math.floor(days), 365));
      return client.post(
        'SystemAudit/SystemAuditGetForHealthCenter',
        {
          days: clampedDays,
          isLoggedIn: true,
          pageSize,
          pageNumber,
          searchText,
        },
        extractPaginationFromHeaders
      );
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const systemAuditZodSchema = {
  action: z.enum(['search', 'health_center']).describe('search=query audit logs with filters, health_center=health dashboard data'),
  startDate: z.string().max(100).optional().describe('Start date (ISO 8601 UTC)'),
  endDate: z.string().max(100).optional().describe('End date (ISO 8601 UTC)'),
  username: z.string().max(500).optional().describe('Filter by username (wildcards supported)'),
  auditAction: z.enum(['Create', 'Delete', 'Logon', 'Modify', 'Read']).optional().describe('Filter by audit action type'),
  ipAddress: z.string().max(500).optional().describe('Filter by IP address'),
  effectiveAction: z.enum(['Denied', 'Permitted']).optional().describe('Filter by effective action'),
  details: z.string().max(1000).optional().describe('Filter by details text (wildcards supported)'),
  viewChildOrganizations: z.boolean().optional().describe('Include child organizations (default: false)'),
  objectId: z.string().max(100).optional().describe('Filter by specific object GUID'),
  days: z.number().optional().describe('Number of days for health_center (default: 7, min: 1, max: 365)'),
  searchText: z.string().max(1000).optional().describe('Search text for health_center'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
};

export const systemAuditTool: ToolDefinition = {
  name: 'threatlocker_system_audit',
  title: 'ThreatLocker System Audit',
  description: `Query ThreatLocker portal audit logs.

System audit tracks administrator actions in the ThreatLocker portal: logins, policy changes, approvals, configuration modifications. This is different from action_log which tracks endpoint events.

Common workflows:
- Find all logins in date range: action=search, startDate="...", endDate="...", auditAction=Logon
- Find failed login attempts: action=search, ..., auditAction=Logon, effectiveAction=Denied
- Find changes by a specific admin: action=search, ..., username="admin@company.com"
- Find policy modifications: action=search, ..., auditAction=Modify, details="*policy*"
- Get health center dashboard: action=health_center, days=7
- Search health center by location: action=health_center, searchText="lat:X&long:Y"

Audit actions: Create (new objects), Delete (removals), Logon (portal access), Modify (changes), Read (views). Supports * wildcard in text fields.

Permissions: View System Audit, View Health Center.
Pagination: search and health_center actions are paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: systemAuditId, username, action, effectiveAction, details, ipAddress, dateTime.

Related tools: threatlocker_action_log (endpoint events, not portal events), threatlocker_organizations (filter by org)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: systemAuditZodSchema,
  handler: handleSystemAuditTool,
};
