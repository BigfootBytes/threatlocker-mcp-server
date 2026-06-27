import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromJsonHeader } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof networkAccessPoliciesZodSchema>>;

export async function handleNetworkAccessPoliciesTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const { action, networkAccessPolicyId, searchText, appliesToId } = input as ToolInput;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber as number | undefined, input.pageSize as number | undefined);

  switch (action) {
    case 'get': {
      if (!networkAccessPolicyId) {
        return errorResponse('BAD_REQUEST', 'networkAccessPolicyId is required for get action');
      }
      const guidError = validateGuid(networkAccessPolicyId, 'networkAccessPolicyId');
      if (guidError) return guidError;
      return client.get('NetworkAccessPolicy/NetworkAccessPolicyGetById', { networkAccessPolicyId });
    }

    case 'list': {
      if (appliesToId) {
        const guidError = validateGuid(appliesToId, 'appliesToId');
        if (guidError) return guidError;
      }
      const body: Record<string, unknown> = { pageNumber, pageSize };
      if (searchText) body.searchText = searchText;
      if (appliesToId) body.appliesToId = appliesToId;
      return client.post(
        'NetworkAccessPolicy/NetworkAccessPolicyGetByParameters',
        body,
        extractPaginationFromJsonHeader
      );
    }

    case 'create': {
      const name = input.name as string | undefined;
      const computerGroupId = input.computerGroupId as string | undefined;
      const direction = input.direction as number | undefined;
      const policyActionId = input.policyActionId as number | undefined;
      if (!name) return errorResponse('BAD_REQUEST', 'name is required for create action');
      if (!computerGroupId) return errorResponse('BAD_REQUEST', 'computerGroupId is required for create action (org/group/computer GUID)');
      const groupErr = validateGuid(computerGroupId, 'computerGroupId');
      if (groupErr) return groupErr;
      if (!direction) return errorResponse('BAD_REQUEST', 'direction is required for create action (1=Inbound, 2=Outbound)');
      if (!policyActionId) return errorResponse('BAD_REQUEST', 'policyActionId is required for create action (1=Permit, 2=Deny)');
      return client.post('NetworkAccessPolicy/NetworkAccessPolicyInsert', {
        name,
        computerGroupId,
        direction,
        policyActionId,
        protocol: input.protocol ?? 3,
        status: input.status ?? 1,
        allSources: input.allSources ?? false,
        allDestinations: input.allDestinations ?? false,
        allPorts: input.allPorts ?? false,
        sourceLocations: input.sourceLocations ?? [],
        destinationLocations: input.destinationLocations ?? [],
        networkAccessRulePortDtos: input.ports ?? [],
        policyScheduleStatus: 0,
      });
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const networkAccessPoliciesZodSchema = {
  action: z.enum(['get', 'list', 'create']).describe('get=single policy by ID, list=search/list network access policies, create=create a network control policy (deploy afterwards)'),
  networkAccessPolicyId: z.string().max(100).optional().describe('Network access policy GUID (required for get). Find via list action first.'),
  searchText: z.string().max(1000).optional().describe('Search text to filter policies'),
  appliesToId: z.string().max(100).optional().describe('Computer group GUID to filter by. Find via computer_groups first.'),
  name: z.string().max(200).optional().describe('Policy name (required for create).'),
  computerGroupId: z.string().max(100).optional().describe('Org/group/computer GUID the policy applies to (required for create). No Global level in Network Control.'),
  direction: z.union([z.literal(1), z.literal(2)]).optional().describe('1=Inbound, 2=Outbound (required for create).'),
  protocol: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().describe('1=TCP, 2=UDP, 3=Both (default: 3).'),
  policyActionId: z.union([z.literal(1), z.literal(2)]).optional().describe('1=Permit, 2=Deny (required for create).'),
  status: z.union([z.literal(1), z.literal(3)]).optional().describe('1=Active, 3=Inactive (default: 1).'),
  allSources: z.boolean().optional().describe('Match any source (create).'),
  allDestinations: z.boolean().optional().describe('Match any destination (create).'),
  allPorts: z.boolean().optional().describe('Match any port (create).'),
  sourceLocations: z.array(z.object({
    ruleLocationTypeId: z.number().describe('1=IPv4, 2=IPv6, 3=Tag, 4=Keyword(inbound), 6=Object(inbound)'),
    text: z.string().describe('CIDR/keyword/tag label ("ParentOrg\\\\TagName" for parent tags)'),
    value: z.string().describe('CIDR for IP, or tagId for Tag'),
  })).max(100).optional().describe('Source locations (create).'),
  destinationLocations: z.array(z.object({
    ruleLocationTypeId: z.number().describe('1=IPv4, 2=IPv6, 3=Tag, 5=Text/Domain(outbound)'),
    text: z.string(),
    value: z.string(),
  })).max(100).optional().describe('Destination locations (create).'),
  ports: z.array(z.string().max(50)).max(100).optional().describe('Port entries, e.g. ["20-25","3389"] (create).'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
};

const networkAccessPolicyObject = z.object({
  networkAccessPolicyId: z.string(),
  name: z.string(),
  policyActionId: z.number().describe('1=Permit, 2=Deny'),
  isEnabled: z.boolean(),
  organizationId: z.string(),
  osType: z.number(),
  direction: z.number().describe('1=Inbound, 2=Outbound'),
}).passthrough();

export const networkAccessPoliciesOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    networkAccessPolicyObject.describe('get: single network access policy'),
    z.array(networkAccessPolicyObject).describe('list: array of network access policies'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const networkAccessPoliciesTool: ToolDefinition = {
  name: 'network_access_policies',
  title: 'ThreatLocker Network Access Policies',
  description: `Query ThreatLocker network access control policies.

Network access policies define firewall rules for endpoints — controlling which applications can make or receive network connections, and to which destinations (IPs, ports, domains).

Common workflows:
- List all network access policies: action=list
- Search by name: action=list, searchText="RPC"
- Filter by computer group: action=list, appliesToId="group-id"
- Get policy details by ID: action=get, networkAccessPolicyId="..."

Pitfalls:
- Network Control has no Global policy level (unlike application control).
- Tag-based rules need the tag label + id resolved via the tags tool (dropdown); parent-org tags use the "ParentOrg\\TagName" format.
- direction: 1=Inbound, 2=Outbound; policyActionId: 1=Permit, 2=Deny.

Permissions: Edit Network Control Policies, View Network Control Policies.
Pagination: list action is paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: networkAccessPolicyId, name, computerGroupName, isEnabled, applicationName.

Related tools: policies (application control policies), computer_groups (where policy applies), tags (network tags used in policies)`,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  writeActions: new Set(['create']),
  zodSchema: networkAccessPoliciesZodSchema,
  outputZodSchema: networkAccessPoliciesOutputZodSchema,
  handler: handleNetworkAccessPoliciesTool,
};
