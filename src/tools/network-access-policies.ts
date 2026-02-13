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

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const networkAccessPoliciesZodSchema = {
  action: z.enum(['get', 'list']).describe('get=single policy by ID, list=search/list network access policies'),
  networkAccessPolicyId: z.string().max(100).optional().describe('Network access policy GUID (required for get). Find via list action first.'),
  searchText: z.string().max(1000).optional().describe('Search text to filter policies'),
  appliesToId: z.string().max(100).optional().describe('Computer group GUID to filter by. Find via threatlocker_computer_groups first.'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
};

const networkAccessPolicyObject = z.object({
  networkAccessPolicyId: z.string(),
  name: z.string(),
  computerGroupName: z.string(),
  isEnabled: z.boolean(),
  applicationName: z.string(),
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
  name: 'threatlocker_network_access_policies',
  title: 'ThreatLocker Network Access Policies',
  description: `Query ThreatLocker network access control policies.

Network access policies define firewall rules for endpoints — controlling which applications can make or receive network connections, and to which destinations (IPs, ports, domains).

Common workflows:
- List all network access policies: action=list
- Search by name: action=list, searchText="RPC"
- Filter by computer group: action=list, appliesToId="group-id"
- Get policy details by ID: action=get, networkAccessPolicyId="..."

Permissions: Edit Network Control Policies, View Network Control Policies.
Pagination: list action is paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: networkAccessPolicyId, name, computerGroupName, isEnabled, applicationName.

Related tools: threatlocker_policies (application control policies), threatlocker_computer_groups (where policy applies), threatlocker_tags (network tags used in policies)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: networkAccessPoliciesZodSchema,
  outputZodSchema: networkAccessPoliciesOutputZodSchema,
  handler: handleNetworkAccessPoliciesTool,
};
