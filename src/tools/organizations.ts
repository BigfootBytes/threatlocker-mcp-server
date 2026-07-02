import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
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

    case 'timezones':
      // Read helper: supplies valid timezoneId values for create_child.
      return client.get('User/UserGetAllTimezones', {});

    case 'create_child': {
      const displayName = input.displayName as string | undefined;
      const timezoneId = input.timezoneId as string | undefined;
      if (!displayName) return errorResponse('BAD_REQUEST', 'displayName is required for create_child action');
      if (!timezoneId) return errorResponse('BAD_REQUEST', 'timezoneId is required for create_child action (get a valid id from action=timezones)');
      return client.post('Organization/OrganizationCreateChild', {
        displayName,
        timezoneId,
        name: (input.name as string | undefined) ?? displayName,
        domains: (input.domains as string[] | undefined) ?? [],
        elevationDefaultHours: input.elevationDefaultHours,
        hasDisabledEmailNotifications: input.hasDisabledEmailNotifications ?? false,
        itarCompliant: input.itarCompliant ?? false,
        options: (input.options as string[] | undefined) ?? [],
        proxyServerOption: (input.proxyServerOption as string | undefined) ?? '',
        proxyUrlEntry: (input.proxyUrlEntry as string | undefined) ?? '',
        timeoutOnLogin: input.timeoutOnLogin,
        useProxyServer: input.useProxyServer ?? false,
      });
    }

    case 'rotate_auth_key':
      // Destructive: generates a NEW auth key; existing deploy scripts using the old key break.
      return client.post('Organization/OrganizationUpdateAuthKeyById', {});

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const organizationsZodSchema = {
  action: z.enum(['list_children', 'get_auth_key', 'get_for_move_computers', 'timezones', 'create_child', 'rotate_auth_key']).describe('list_children=list child orgs, get_auth_key=installation key for current org, get_for_move_computers=orgs available for computer relocation, timezones=list valid timezone ids (for create_child), create_child=create a child organization, rotate_auth_key=generate a NEW org auth key (DESTRUCTIVE: breaks existing deploy scripts)'),
  displayName: z.string().max(200).optional().describe('create_child: human-readable org name (required).'),
  timezoneId: z.string().max(200).optional().describe('create_child: timezone id from action=timezones (required). Use the exact id value, not the display name.'),
  name: z.string().max(200).optional().describe('create_child: RMM identifier used in deploy scripts (defaults to displayName). A mismatch creates duplicates.'),
  domains: z.array(z.string().max(255)).max(50).optional().describe('create_child: org domains (e.g. ["client.com"]).'),
  elevationDefaultHours: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(6), z.literal(12), z.literal(24)]).optional().describe('create_child: default elevation expiry hours (0=no expiration).'),
  hasDisabledEmailNotifications: z.boolean().optional().describe('create_child: disable user emails except password resets (default false).'),
  itarCompliant: z.boolean().optional().describe('create_child: restrict access/management to inside the USA (default false).'),
  options: z.array(z.string().max(200)).max(100).optional().describe('create_child: org option names (inherits from parent if omitted).'),
  proxyServerOption: z.string().max(50).optional().describe('create_child: proxy protocol ("http://"/"https://"); requires useProxyServer=true.'),
  proxyUrlEntry: z.string().max(500).optional().describe('create_child: proxy URL; requires useProxyServer=true.'),
  timeoutOnLogin: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(120), z.literal(240), z.literal(480), z.literal(1440)]).optional().describe('create_child: login timeout in minutes.'),
  useProxyServer: z.boolean().optional().describe('create_child: enable proxy configuration (default false).'),
  searchText: z.string().max(1000).optional().describe('Filter by name (for list_children)'),
  includeAllChildren: z.boolean().optional().describe('Include nested children (default: false)'),
  orderBy: z.enum(['billingMethod', 'businessClassificationName', 'dateAdded', 'name']).optional().describe('Field to order by'),
  isAscending: z.boolean().optional().describe('Sort ascending (default: true)'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
};

const organizationObject = z.object({
  organizationId: z.string().nullable(),
  name: z.string().nullable(),
  displayName: z.string().nullable(),
  dateAdded: z.string().nullable(),
  computerCount: z.number(),
}).passthrough();

const dropdownItem = z.object({
  label: z.string().nullable(),
  value: z.string().nullable(),
}).passthrough();

export const organizationsOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(organizationObject).describe('list_children: array of organizations'),
    z.array(dropdownItem).describe('get_for_move_computers: array of dropdown items'),
    z.object({}).passthrough().describe('get_auth_key: authentication key details'),
    z.array(dropdownItem).describe('timezones: array of timezone options'),
    z.any().describe('create_child/rotate_auth_key: operation result'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const organizationsTool: ToolDefinition = {
  name: 'organizations',
  title: 'ThreatLocker Organizations',
  description: `Query ThreatLocker organizations.

Organizations are the top-level containers in ThreatLocker. MSPs have a parent organization with child organizations for each client. Enterprises may have organizations per business unit or location.

Common workflows:
- List child organizations: action=list_children
- Search for a client org: action=list_children, searchText="client name"
- List all nested children (full tree): action=list_children, includeAllChildren=true
- Get installation auth key: action=get_auth_key
- Get orgs available for moving computers: action=get_for_move_computers
- Provision a client org: action=timezones (pick an id) → action=create_child, displayName="...", timezoneId="..." → get_auth_key → deploy
- Rotate the org auth key: action=rotate_auth_key (DESTRUCTIVE — invalidates the old key and breaks existing deploy scripts)

The organizationId is needed for many API calls (policies, applications, etc.) to scope the request to a specific organization.

Pitfalls:
- get_auth_key returns the install/auth key used to deploy agents and to resolve groups via computer_groups get_by_install_key.

Permissions: View Organizations, Edit Organizations, Super Admin - Child.
Pagination: list_children is paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: organizationId, name, displayName, dateAdded, computerCount.

Related tools: computers (computers in org), computer_groups (groups in org), policies (policies in org)`,
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  zodSchema: organizationsZodSchema,
  outputZodSchema: organizationsOutputZodSchema,
  writeActions: new Set(['create_child', 'rotate_auth_key']),
  handler: handleOrganizationsTool,
};
