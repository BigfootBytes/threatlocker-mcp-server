import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromJsonHeader } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof storagePoliciesZodSchema>>;

export async function handleStoragePoliciesTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const { action, storagePolicyId, searchText, appliesToId, policyType, osType } = input as ToolInput;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber as number | undefined, input.pageSize as number | undefined);

  switch (action) {
    case 'get': {
      if (!storagePolicyId) {
        return errorResponse('BAD_REQUEST', 'storagePolicyId is required for get action');
      }
      const guidError = validateGuid(storagePolicyId, 'storagePolicyId');
      if (guidError) return guidError;
      return client.get('StoragePolicy/StoragePolicyGetById', { storagePolicyId });
    }

    case 'list': {
      if (appliesToId) {
        const guidError = validateGuid(appliesToId, 'appliesToId');
        if (guidError) return guidError;
      }
      const body: Record<string, unknown> = { pageNumber, pageSize };
      if (searchText) body.searchText = searchText;
      if (appliesToId) body.appliesToId = appliesToId;
      if (policyType !== undefined) body.policyType = policyType;
      if (osType !== undefined) body.osType = osType;
      return client.post(
        'StoragePolicy/StoragePolicyGetByParameters',
        body,
        extractPaginationFromJsonHeader
      );
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const storagePoliciesZodSchema = {
  action: z.enum(['get', 'list']).describe('get=single policy by ID, list=search/list storage policies'),
  storagePolicyId: z.string().max(100).optional().describe('Storage policy GUID (required for get). Find via list action first.'),
  searchText: z.string().max(1000).optional().describe('Search text to filter policies'),
  appliesToId: z.string().max(100).optional().describe('Computer group GUID to filter by. Find via computer_groups first.'),
  policyType: z.number().optional().describe('Filter by policy type'),
  osType: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).optional().describe('OS type: 0=All, 1=Windows, 2=macOS, 3=Linux, 5=Windows XP'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
};

const storagePolicyObject = z.object({
  storagePolicyId: z.string(),
  name: z.string(),
  policyType: z.string(),
  policyActionId: z.number(),
  osType: z.number(),
  isEnabled: z.boolean(),
  appliesToId: z.string(),
  organizationId: z.string(),
}).passthrough();

export const storagePoliciesOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    storagePolicyObject.describe('get: single storage policy'),
    z.array(storagePolicyObject).describe('list: array of storage policies'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const storagePoliciesTool: ToolDefinition = {
  name: 'storage_policies',
  title: 'ThreatLocker Storage Policies',
  description: `Query ThreatLocker storage control policies.

Storage policies define rules for file and folder access on endpoints — controlling which applications can read, write, or execute from specific storage locations (local drives, USB devices, network shares).

Common workflows:
- List all storage policies: action=list
- Search by name: action=list, searchText="USB"
- Filter by computer group: action=list, appliesToId="group-id"
- Get policy details by ID: action=get, storagePolicyId="..."

Permissions: View Storage Control Policies, Edit Storage Control Policies.
Pagination: list action is paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: storagePolicyId, name, policyType, osType, computerGroupName, isEnabled.

Related tools: policies (application control policies), computer_groups (where policy applies), applications (what the policy permits)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: storagePoliciesZodSchema,
  outputZodSchema: storagePoliciesOutputZodSchema,
  handler: handleStoragePoliciesTool,
};
