import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const applicationsToolSchema = {
  name: 'applications',
  description: 'Search and inspect ThreatLocker applications',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['search', 'get', 'research'],
        description: 'Action to perform',
      },
      applicationId: {
        type: 'string',
        description: 'Application ID (required for get and research)',
      },
      searchText: {
        type: 'string',
        description: 'Search text for search action',
      },
      searchBy: {
        type: 'string',
        enum: ['app', 'full', 'process', 'hash', 'cert', 'created', 'categories', 'countries'],
        description: 'Field to search by (default: app)',
      },
      osType: {
        type: 'number',
        enum: [0, 1, 2, 3, 5],
        description: 'OS type: 0=All, 1=Windows, 2=macOS, 3=Linux, 5=Windows XP',
      },
      category: {
        type: 'number',
        description: 'Category filter',
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

interface ApplicationsInput {
  action?: 'search' | 'get' | 'research';
  applicationId?: string;
  searchText?: string;
  searchBy?: string;
  osType?: number;
  category?: number;
  pageNumber?: number;
  pageSize?: number;
}

export async function handleApplicationsTool(
  client: ThreatLockerClient,
  input: ApplicationsInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    applicationId,
    searchText = '',
    searchBy = 'app',
    osType = 0,
    category = 0,
    pageNumber = 1,
    pageSize = 25,
  } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'search':
      return client.post(
        'Application/ApplicationGetByParameters',
        {
          pageNumber,
          pageSize,
          searchText,
          searchBy,
          osType,
          category,
          isAscending: true,
          orderBy: 'name',
          includeChildOrganizations: false,
          isHidden: false,
          permittedApplications: false,
        },
        extractPaginationFromHeaders
      );

    case 'get':
      if (!applicationId) {
        return errorResponse('BAD_REQUEST', 'applicationId is required for get action');
      }
      return client.get('Application/ApplicationGetById', { applicationId });

    case 'research':
      if (!applicationId) {
        return errorResponse('BAD_REQUEST', 'applicationId is required for research action');
      }
      return client.get('Application/ApplicationGetResearchDetailsById', { applicationId });

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
