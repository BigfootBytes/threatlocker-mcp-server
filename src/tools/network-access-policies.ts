import { ThreatLockerClient, extractPaginationFromJsonHeader } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid } from '../types/responses.js';

export const networkAccessPoliciesToolSchema = {
  name: 'network_access_policies',
  description: `Query ThreatLocker network access control policies.

Network access policies define firewall rules for endpoints — controlling which applications can make or receive network connections, and to which destinations (IPs, ports, domains).

Common workflows:
- List all network access policies: action=list
- Search by name: action=list, searchText="RPC"
- Filter by computer group: action=list, appliesToId="group-id"
- Get policy details by ID: action=get, networkAccessPolicyId="..."

Related tools: policies (application control policies), computer_groups (where policy applies), tags (network tags used in policies)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'list'],
        description: 'get=single policy by ID, list=search/list network access policies',
      },
      networkAccessPolicyId: {
        type: 'string',
        description: 'Network access policy GUID (required for get action).',
      },
      searchText: {
        type: 'string',
        description: 'Search text to filter policies by name.',
      },
      appliesToId: {
        type: 'string',
        description: 'Filter to policies for a specific computer group. Get group IDs from computer_groups tool.',
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

interface NetworkAccessPoliciesInput {
  action?: 'get' | 'list';
  networkAccessPolicyId?: string;
  searchText?: string;
  appliesToId?: string;
  pageNumber?: number;
  pageSize?: number;
}

export async function handleNetworkAccessPoliciesTool(
  client: ThreatLockerClient,
  input: NetworkAccessPoliciesInput
): Promise<ApiResponse<unknown>> {
  const { action, networkAccessPolicyId, searchText, appliesToId } = input;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber, input.pageSize);

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

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
