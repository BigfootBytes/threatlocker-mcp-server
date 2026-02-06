import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination } from '../types/responses.js';

export const approvalRequestsToolSchema = {
  name: 'approval_requests',
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

Related tools: action_log (see the deny event), applications (find matching apps), policies (create permits)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'count', 'get_file_download_details', 'get_permit_application', 'get_storage_approval'],
        description: 'list=search requests, get=single request details, count=pending count, get_file_download_details=file download info, get_permit_application=permit options, get_storage_approval=storage request details',
      },
      approvalRequestId: {
        type: 'string',
        description: 'Request GUID (required for get, get_file_download_details, get_permit_application, get_storage_approval). Get from list action.',
      },
      statusId: {
        type: 'number',
        enum: [1, 4, 6, 10, 12, 13, 16],
        description: 'Filter by status: 1=Pending, 4=Approved, 6=Not Learned, 10=Ignored, 12=Added to Application, 13=Escalated, 16=Self-Approved',
      },
      searchText: {
        type: 'string',
        description: 'Search in username, path, computer name. Supports wildcards.',
      },
      orderBy: {
        type: 'string',
        enum: ['username', 'devicetype', 'actiontype', 'path', 'actiondate', 'datetime'],
        description: 'Sort field: username, devicetype (computer type), actiontype (execute/network/storage), path (file path), actiondate (when blocked), datetime (when requested)',
      },
      isAscending: {
        type: 'boolean',
        description: 'Sort direction. false with datetime shows newest first.',
      },
      showChildOrganizations: {
        type: 'boolean',
        description: 'Include requests from child organizations (MSP/enterprise view).',
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

interface ApprovalRequestsInput {
  action?: 'list' | 'get' | 'count' | 'get_file_download_details' | 'get_permit_application' | 'get_storage_approval';
  approvalRequestId?: string;
  statusId?: number;
  searchText?: string;
  orderBy?: string;
  isAscending?: boolean;
  showChildOrganizations?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

export async function handleApprovalRequestsTool(
  client: ThreatLockerClient,
  input: ApprovalRequestsInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    approvalRequestId,
    statusId,
    searchText = '',
    orderBy = 'datetime',
    isAscending = true,
    showChildOrganizations = false,
  } = input;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber, input.pageSize);

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list':
      return client.post(
        'ApprovalRequest/ApprovalRequestGetByParameters',
        {
          statusId,
          searchText,
          orderBy,
          isAscending,
          showChildOrganizations,
          pageNumber,
          pageSize,
        },
        extractPaginationFromHeaders
      );

    case 'get':
      if (!approvalRequestId) {
        return errorResponse('BAD_REQUEST', 'approvalRequestId is required for get action');
      }
      return client.get('ApprovalRequest/ApprovalRequestGetById', { approvalRequestId });

    case 'count':
      return client.get('ApprovalRequest/ApprovalRequestGetCount', {});

    case 'get_file_download_details':
      if (!approvalRequestId) {
        return errorResponse('BAD_REQUEST', 'approvalRequestId is required for get_file_download_details action');
      }
      return client.get('ApprovalRequest/ApprovalRequestGetFileDownloadDetailsById', { approvalRequestId });

    case 'get_permit_application':
      if (!approvalRequestId) {
        return errorResponse('BAD_REQUEST', 'approvalRequestId is required for get_permit_application action');
      }
      return client.get('ApprovalRequest/ApprovalRequestGetPermitApplicationById', { approvalRequestId });

    case 'get_storage_approval':
      if (!approvalRequestId) {
        return errorResponse('BAD_REQUEST', 'approvalRequestId is required for get_storage_approval action');
      }
      return client.get('ApprovalRequest/ApprovalRequestGetStorageApprovalById', { approvalRequestId });

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
