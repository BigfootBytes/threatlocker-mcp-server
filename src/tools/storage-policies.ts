import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromJsonHeader } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

export const storagePoliciesToolSchema = {
  name: 'storage_policies',
  description: `Query ThreatLocker storage control policies.

Storage policies define rules for file and folder access on endpoints — controlling which applications can read, write, or execute from specific storage locations (local drives, USB devices, network shares).

Common workflows:
- List all storage policies: action=list
- Search by name: action=list, searchText="USB"
- Filter by computer group: action=list, appliesToId="group-id"
- Get policy details by ID: action=get, storagePolicyId="..."

Related tools: policies (application control policies), computer_groups (where policy applies), applications (what the policy permits)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'list'],
        description: 'get=single policy by ID, list=search/list storage policies',
      },
      storagePolicyId: {
        type: 'string',
        description: 'Storage policy GUID (required for get action).',
      },
      searchText: {
        type: 'string',
        description: 'Search text to filter policies by name.',
      },
      appliesToId: {
        type: 'string',
        description: 'Filter to policies for a specific computer group. Get group IDs from computer_groups tool.',
      },
      policyType: {
        type: 'number',
        description: 'Filter by policy type.',
      },
      osType: {
        type: 'number',
        enum: [0, 1, 2, 3, 5],
        description: 'Filter by OS: 0=All, 1=Windows, 2=macOS, 3=Linux, 5=Windows XP',
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

interface StoragePoliciesInput {
  action?: 'get' | 'list';
  storagePolicyId?: string;
  searchText?: string;
  appliesToId?: string;
  policyType?: number;
  osType?: number;
  pageNumber?: number;
  pageSize?: number;
}

export async function handleStoragePoliciesTool(
  client: ThreatLockerClient,
  input: StoragePoliciesInput
): Promise<ApiResponse<unknown>> {
  const { action, storagePolicyId, searchText, appliesToId, policyType, osType } = input;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber, input.pageSize);

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

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
  action: z.enum(['get', 'list']).describe('Action to perform'),
  storagePolicyId: z.string().max(100).optional().describe('Storage policy ID (required for get)'),
  searchText: z.string().max(1000).optional().describe('Search text to filter policies'),
  appliesToId: z.string().max(100).optional().describe('Computer group ID to filter by'),
  policyType: z.number().optional().describe('Filter by policy type'),
  osType: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).optional().describe('OS type: 0=All, 1=Windows, 2=macOS, 3=Linux, 5=Windows XP'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25)'),
};

export const storagePoliciesTool: ToolDefinition = {
  name: storagePoliciesToolSchema.name,
  description: storagePoliciesToolSchema.description,
  inputSchema: storagePoliciesToolSchema.inputSchema,
  zodSchema: storagePoliciesZodSchema,
  handler: handleStoragePoliciesTool as ToolDefinition['handler'],
};
