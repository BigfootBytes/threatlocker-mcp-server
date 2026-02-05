import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const applicationsToolSchema = {
  name: 'applications',
  description: `Search and inspect ThreatLocker applications.

Applications are collections of file rules (hashes, paths, certificates) that define what software is allowed or denied. ThreatLocker comes with built-in applications for common software, and you can create custom ones.

Common workflows:
- Find an application by name: action=search, searchText="Chrome"
- Find apps by file hash: action=search, searchBy=hash, searchText="abc123..."
- Find apps by certificate: action=search, searchBy=cert, searchText="Microsoft"
- Get ThreatLocker research on an app: action=research, applicationId="..."
- List files in an application: action=files, applicationId="..."
- Find apps actively permitted: action=search, permittedApplications=true
- Find recently created custom apps: action=search, category=1, orderBy=date-created

Related tools: policies (see policies using this app), action_log (see app activity), approval_requests (pending approvals for this app)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['search', 'get', 'research', 'files'],
        description: 'search=find applications, get=details by ID, research=ThreatLocker security analysis, files=list file rules in app',
      },
      applicationId: {
        type: 'string',
        description: 'Application GUID (required for get, research, and files). Find via search action first.',
      },
      searchText: {
        type: 'string',
        description: 'Search text. Supports wildcards (*). Examples: "Chrome*", "*Office*", or a SHA256 hash.',
      },
      searchBy: {
        type: 'string',
        enum: ['app', 'full', 'process', 'hash', 'cert', 'created', 'categories', 'countries'],
        description: 'Search field: app=name (default), full=full path rules, process=process path, hash=SHA256, cert=certificate subject, created=created by path, categories=app categories, countries=compilation country',
      },
      osType: {
        type: 'number',
        enum: [0, 1, 2, 3, 5],
        description: 'Filter by OS: 0=All, 1=Windows, 2=macOS, 3=Linux, 5=Windows XP (legacy)',
      },
      category: {
        type: 'number',
        enum: [0, 1, 2],
        description: 'Filter by source: 0=All, 1=My Applications (custom apps you created), 2=Built-In (ThreatLocker curated apps)',
      },
      orderBy: {
        type: 'string',
        enum: ['name', 'date-created', 'review-rating', 'computer-count', 'policy'],
        description: 'Sort field: name, date-created (newest first when desc), review-rating (ThreatLocker security rating), computer-count (deployment spread), policy (policy count)',
      },
      isAscending: {
        type: 'boolean',
        description: 'Sort direction. false with date-created shows newest first.',
      },
      includeChildOrganizations: {
        type: 'boolean',
        description: 'Include applications from child organizations (MSP/enterprise view).',
      },
      isHidden: {
        type: 'boolean',
        description: 'Include hidden/temporary applications. Useful for finding auto-created learning apps.',
      },
      permittedApplications: {
        type: 'boolean',
        description: 'Only show apps with active permit policies. Useful for auditing what software is allowed.',
      },
      countries: {
        type: 'array',
        items: { type: 'string' },
        description: 'ISO country codes (e.g., ["US", "GB"]). Use with searchBy=countries to find apps compiled in specific countries.',
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

interface ApplicationsInput {
  action?: 'search' | 'get' | 'research' | 'files';
  applicationId?: string;
  searchText?: string;
  searchBy?: string;
  osType?: number;
  category?: number;
  orderBy?: string;
  isAscending?: boolean;
  includeChildOrganizations?: boolean;
  isHidden?: boolean;
  permittedApplications?: boolean;
  countries?: string[];
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
    orderBy = 'name',
    isAscending = true,
    includeChildOrganizations = false,
    isHidden = false,
    permittedApplications = false,
    countries,
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
          orderBy,
          isAscending,
          includeChildOrganizations,
          isHidden,
          permittedApplications,
          countries,
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

    case 'files':
      if (!applicationId) {
        return errorResponse('BAD_REQUEST', 'applicationId is required for files action');
      }
      return client.get('ApplicationFile/ApplicationFileGetByApplicationId', {
        applicationId,
        searchText,
        pageNumber: String(pageNumber),
        pageSize: String(pageSize),
      });

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
