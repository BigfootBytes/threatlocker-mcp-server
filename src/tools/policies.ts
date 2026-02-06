import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination } from '../types/responses.js';

export const policiesToolSchema = {
  name: 'policies',
  description: `Inspect ThreatLocker policies.

Policies define what applications can run on which computer groups. A policy links an application (set of file rules) to a computer group with an action (permit/deny/ringfence).

Common workflows:
- Get policy details by ID: action=get, policyId="..."
- List all policies for an application: action=list_by_application, applicationId="...", organizationId="..."
- Find policies for a specific group: action=list_by_application, applicationId="...", organizationId="...", appliesToId="group-id"
- Include deny policies in results: action=list_by_application, ..., includeDenies=true

Policy actions: Permit (allow), Deny (block), Ringfence (allow but restrict network/storage access)

Related tools: applications (what the policy permits), computer_groups (where policy applies), action_log (see policy enforcement)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'list_by_application'],
        description: 'get=single policy by ID, list_by_application=all policies for an application',
      },
      policyId: {
        type: 'string',
        description: 'Policy GUID (required for get). Find via list_by_application or action_log.',
      },
      applicationId: {
        type: 'string',
        description: 'Application GUID (required for list_by_application). Get from applications tool.',
      },
      organizationId: {
        type: 'string',
        description: 'Organization GUID (required for list_by_application). Get from organizations tool.',
      },
      appliesToId: {
        type: 'string',
        description: 'Filter to policies for a specific computer group. Get group IDs from computer_groups tool.',
      },
      includeDenies: {
        type: 'boolean',
        description: 'Include deny policies in results. By default only permit/ringfence policies are shown.',
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

interface PoliciesInput {
  action?: 'get' | 'list_by_application';
  policyId?: string;
  applicationId?: string;
  organizationId?: string;
  appliesToId?: string;
  includeDenies?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

export async function handlePoliciesTool(
  client: ThreatLockerClient,
  input: PoliciesInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    policyId,
    applicationId,
    organizationId,
    appliesToId,
    includeDenies = false,
  } = input;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber, input.pageSize);

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'get':
      if (!policyId) {
        return errorResponse('BAD_REQUEST', 'policyId is required for get action');
      }
      return client.get('Policy/PolicyGetById', { policyId });

    case 'list_by_application':
      if (!applicationId) {
        return errorResponse('BAD_REQUEST', 'applicationId is required for list_by_application action');
      }
      if (!organizationId) {
        return errorResponse('BAD_REQUEST', 'organizationId is required for list_by_application action');
      }
      return client.post(
        'Policy/PolicyGetForViewPoliciesByApplicationId',
        {
          applicationId,
          organizationId,
          pageNumber,
          pageSize,
          appliesToId: appliesToId || '',
          includeDenies,
        },
        extractPaginationFromHeaders
      );

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
