import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof approvalRequestsZodSchema>>;

export async function handleApprovalRequestsTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const {
    action,
    approvalRequestId,
    statusId,
    searchText = '',
    orderBy = 'datetime',
    isAscending = true,
    showChildOrganizations = false,
  } = input as ToolInput;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber as number | undefined, input.pageSize as number | undefined);

  switch (action) {
    case 'list':
      return client.post(
        'ApprovalRequest/ApprovalRequestGetByParameters',
        {
          statusId: statusId ?? 1,
          searchText,
          orderBy,
          isAscending,
          showChildOrganizations,
          pageNumber,
          pageSize,
        },
        extractPaginationFromHeaders
      );

    case 'get': {
      if (!approvalRequestId) {
        return errorResponse('BAD_REQUEST', 'approvalRequestId is required for get action');
      }
      const guidError = validateGuid(approvalRequestId, 'approvalRequestId');
      if (guidError) return guidError;
      return client.get('ApprovalRequest/ApprovalRequestGetById', { approvalRequestId });
    }

    case 'count':
      return client.get('ApprovalRequest/ApprovalRequestGetCount', {});

    case 'get_file_download_details': {
      if (!approvalRequestId) {
        return errorResponse('BAD_REQUEST', 'approvalRequestId is required for get_file_download_details action');
      }
      const guidError = validateGuid(approvalRequestId, 'approvalRequestId');
      if (guidError) return guidError;
      return client.get('ApprovalRequest/ApprovalRequestGetFileDownloadDetailsById', { approvalRequestId });
    }

    case 'get_permit_application': {
      if (!approvalRequestId) {
        return errorResponse('BAD_REQUEST', 'approvalRequestId is required for get_permit_application action');
      }
      const guidError = validateGuid(approvalRequestId, 'approvalRequestId');
      if (guidError) return guidError;
      return client.get('ApprovalRequest/ApprovalRequestGetPermitApplicationById', { approvalRequestId });
    }

    case 'get_storage_approval': {
      if (!approvalRequestId) {
        return errorResponse('BAD_REQUEST', 'approvalRequestId is required for get_storage_approval action');
      }
      const guidError = validateGuid(approvalRequestId, 'approvalRequestId');
      if (guidError) return guidError;
      return client.get('ApprovalRequest/ApprovalRequestGetStorageApprovalById', { approvalRequestId });
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const approvalRequestsZodSchema = {
  action: z.enum(['list', 'get', 'count', 'get_file_download_details', 'get_permit_application', 'get_storage_approval']).describe('list=search requests, get=single request details, count=pending count, get_file_download_details=file download info, get_permit_application=permit options, get_storage_approval=storage request details'),
  approvalRequestId: z.string().max(100).optional().describe('Approval request GUID (required for get, get_file_download_details, get_permit_application, get_storage_approval). Find via list action first.'),
  statusId: z.union([z.literal(1), z.literal(4), z.literal(6), z.literal(10), z.literal(12), z.literal(13), z.literal(16)]).optional().describe('Filter by status: 1=Pending (default for list), 4=Approved, 6=Not Learned, 10=Ignored, 12=Added to Application, 13=Escalated, 16=Self-Approved'),
  searchText: z.string().max(1000).optional().describe('Filter by text'),
  orderBy: z.enum(['username', 'devicetype', 'actiontype', 'path', 'actiondate', 'datetime']).optional().describe('Field to order by'),
  isAscending: z.boolean().optional().describe('Sort ascending (default: true)'),
  showChildOrganizations: z.boolean().optional().describe('Include child organizations (default: false)'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
};

const approvalRequestObject = z.object({
  approvalRequestId: z.string(),
  username: z.string(),
  hostname: z.string(),
  path: z.string(),
  statusId: z.number().describe('1=Pending, 4=Approved, 6=Not Learned, 10=Ignored, 12=Added, 13=Escalated, 16=Self-Approved'),
  dateTime: z.string(),
  organizationId: z.string(),
  computerId: z.string(),
}).passthrough();

export const approvalRequestsOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(approvalRequestObject).describe('list: array of approval requests'),
    approvalRequestObject.describe('get/get_file_download_details/get_permit_application/get_storage_approval: single request'),
    z.number().describe('count: pending request count'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const approvalRequestsTool: ToolDefinition = {
  name: 'approval_requests',
  title: 'ThreatLocker Approval Requests',
  description: `Query ThreatLocker approval requests.

When users encounter blocked software and request access, it creates an approval request. Admins review these requests to decide whether to permit the software by creating policies.

Common workflows:
- List pending requests: action=list, statusId=1
- Get pending request count: action=count
- Find requests for a specific user: action=list, searchText="username"
- Get request details: action=get, approvalRequestId="..."
- Get file info for download/analysis: action=get_file_download_details, approvalRequestId="..."
- Get permit options (apps, groups): action=get_permit_application, approvalRequestId="..."
- Get storage request details: action=get_storage_approval, approvalRequestId="..."

Request statuses: 1=Pending (needs review), 4=Approved, 6=Not Learned (learning mode), 10=Ignored, 12=Added to Application, 13=Escalated (from Cyber Heroes), 16=Self-Approved

Permissions: View Approvals, Approve for Entire Organization/Group/Single Computer.
Pagination: list action is paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: approvalRequestId, username, fullPath, actionType, statusId, computerName, requestDateTime.

Related tools: action_log (see the deny event), applications (find matching apps), policies (create permits)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: approvalRequestsZodSchema,
  outputZodSchema: approvalRequestsOutputZodSchema,
  handler: handleApprovalRequestsTool,
};
