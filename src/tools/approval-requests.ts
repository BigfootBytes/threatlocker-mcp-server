import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const approvalRequestsToolSchema = {
  name: 'approval_requests',
  description: 'Query ThreatLocker approval requests',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'count'],
        description: 'Action to perform',
      },
      approvalRequestId: {
        type: 'string',
        description: 'Approval request ID (required for get action)',
      },
      statusId: {
        type: 'number',
        enum: [1, 4, 6, 10, 12, 13, 16],
        description: 'Filter by status: 1=Pending, 4=Approved, 6=Not Learned, 10=Ignored, 12=Added to Application, 13=Escalated, 16=Self-Approved',
      },
      searchText: {
        type: 'string',
        description: 'Filter by text',
      },
      orderBy: {
        type: 'string',
        enum: ['username', 'devicetype', 'actiontype', 'path', 'actiondate', 'datetime'],
        description: 'Field to order by',
      },
      isAscending: {
        type: 'boolean',
        description: 'Sort ascending (default: true)',
      },
      showChildOrganizations: {
        type: 'boolean',
        description: 'Include child organizations (default: false)',
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

interface ApprovalRequestsInput {
  action?: 'list' | 'get' | 'count';
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
    pageNumber = 1,
    pageSize = 25,
  } = input;

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

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
