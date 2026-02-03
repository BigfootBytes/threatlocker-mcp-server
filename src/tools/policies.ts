import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const policiesToolSchema = {
  name: 'policies',
  description: 'Inspect ThreatLocker policies',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'list_by_application'],
        description: 'Action to perform',
      },
      policyId: {
        type: 'string',
        description: 'Policy ID (required for get)',
      },
      applicationId: {
        type: 'string',
        description: 'Application ID (required for list_by_application)',
      },
      organizationId: {
        type: 'string',
        description: 'Organization ID (required for list_by_application)',
      },
      appliesToId: {
        type: 'string',
        description: 'Computer group ID to filter by',
      },
      includeDenies: {
        type: 'boolean',
        description: 'Include deny policies',
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
    pageNumber = 1,
    pageSize = 25,
  } = input;

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
