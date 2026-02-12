import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

export async function handlePoliciesTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const {
    action,
    policyId,
    applicationId,
    organizationId,
    appliesToId,
    includeDenies = false,
  } = input as any;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber as number | undefined, input.pageSize as number | undefined);

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'get': {
      if (!policyId) {
        return errorResponse('BAD_REQUEST', 'policyId is required for get action');
      }
      const guidError = validateGuid(policyId, 'policyId');
      if (guidError) return guidError;
      return client.get('Policy/PolicyGetById', { policyId });
    }

    case 'list_by_application': {
      if (!applicationId) {
        return errorResponse('BAD_REQUEST', 'applicationId is required for list_by_application action');
      }
      const appGuidError = validateGuid(applicationId, 'applicationId');
      if (appGuidError) return appGuidError;
      if (!organizationId) {
        return errorResponse('BAD_REQUEST', 'organizationId is required for list_by_application action');
      }
      const orgGuidError = validateGuid(organizationId, 'organizationId');
      if (orgGuidError) return orgGuidError;
      if (appliesToId) {
        const appliesToGuidError = validateGuid(appliesToId, 'appliesToId');
        if (appliesToGuidError) return appliesToGuidError;
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
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const policiesZodSchema = {
  action: z.enum(['get', 'list_by_application']).describe('Action to perform'),
  policyId: z.string().max(100).optional().describe('Policy ID (required for get)'),
  applicationId: z.string().max(100).optional().describe('Application ID (required for list_by_application)'),
  organizationId: z.string().max(100).optional().describe('Organization ID (required for list_by_application)'),
  appliesToId: z.string().max(100).optional().describe('Computer group ID to filter by'),
  includeDenies: z.boolean().optional().describe('Include deny policies'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25)'),
};

export const policiesTool: ToolDefinition = {
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
  annotations: { readOnlyHint: true, openWorldHint: true },
  zodSchema: policiesZodSchema,
  handler: handlePoliciesTool,
};
