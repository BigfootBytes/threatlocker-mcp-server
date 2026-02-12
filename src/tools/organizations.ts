import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof organizationsZodSchema>>;

export async function handleOrganizationsTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const {
    action,
    searchText = '',
    includeAllChildren = false,
    orderBy = 'name',
    isAscending = true,
  } = input as ToolInput;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber as number | undefined, input.pageSize as number | undefined);

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list_children':
      return client.post(
        'Organization/OrganizationGetChildOrganizationsByParameters',
        {
          searchText,
          includeAllChildren,
          orderBy,
          isAscending,
          pageNumber,
          pageSize,
        },
        extractPaginationFromHeaders
      );

    case 'get_auth_key':
      return client.get('Organization/OrganizationGetAuthKeyById', {});

    case 'get_for_move_computers':
      return client.get('Organization/OrganizationGetForMoveComputers', {});

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const organizationsZodSchema = {
  action: z.enum(['list_children', 'get_auth_key', 'get_for_move_computers']).describe('Action to perform'),
  searchText: z.string().max(1000).optional().describe('Filter by name (for list_children)'),
  includeAllChildren: z.boolean().optional().describe('Include nested children (default: false)'),
  orderBy: z.enum(['billingMethod', 'businessClassificationName', 'dateAdded', 'name']).optional().describe('Field to order by'),
  isAscending: z.boolean().optional().describe('Sort ascending (default: true)'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25)'),
};

export const organizationsTool: ToolDefinition = {
  name: 'threatlocker_organizations',
  title: 'ThreatLocker Organizations',
  description: `Query ThreatLocker organizations.

Organizations are the top-level containers in ThreatLocker. MSPs have a parent organization with child organizations for each client. Enterprises may have organizations per business unit or location.

Common workflows:
- List child organizations: action=list_children
- Search for a client org: action=list_children, searchText="client name"
- List all nested children (full tree): action=list_children, includeAllChildren=true
- Get installation auth key: action=get_auth_key
- Get orgs available for moving computers: action=get_for_move_computers

The organizationId is needed for many API calls (policies, applications, etc.) to scope the request to a specific organization.

Permissions: View Organizations, Edit Organizations, Super Admin - Child.
Pagination: list_children is paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: organizationId, name, displayName, dateAdded, computerCount.

Related tools: computers (computers in org), computer_groups (groups in org), policies (policies in org)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: organizationsZodSchema,
  handler: handleOrganizationsTool,
};
