import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid, validateSha256 } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

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
- Find matching apps by file properties: action=match, hash="...", path="...", cert="..."
- Get apps for maintenance mode: action=get_for_maintenance
- Get app for network policy: action=get_for_network_policy, applicationId="..."

Related tools: policies (see policies using this app), action_log (see app activity), approval_requests (pending approvals for this app)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['search', 'get', 'research', 'files', 'match', 'get_for_maintenance', 'get_for_network_policy'],
        description: 'search=find applications, get=details by ID, research=ThreatLocker security analysis, files=list file rules in app, match=find apps by file hash/cert/path, get_for_maintenance=apps for maintenance mode, get_for_network_policy=app for network policy',
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
      hash: {
        type: 'string',
        description: 'SHA256 hash for match action.',
      },
      path: {
        type: 'string',
        description: 'Full file path for match action.',
      },
      processPath: {
        type: 'string',
        description: 'Process path for match action.',
      },
      cert: {
        type: 'string',
        description: 'Certificate subject for match action.',
      },
      certSha: {
        type: 'string',
        description: 'Certificate SHA for match action.',
      },
      createdBy: {
        type: 'string',
        description: 'Created by path (e.g., msiexec.exe) for match action.',
      },
    },
    required: ['action'],
  },
};

interface ApplicationsInput {
  action?: 'search' | 'get' | 'research' | 'files' | 'match' | 'get_for_maintenance' | 'get_for_network_policy';
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
  hash?: string;
  path?: string;
  processPath?: string;
  cert?: string;
  certSha?: string;
  createdBy?: string;
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
    hash,
    path,
    processPath,
    cert,
    certSha,
    createdBy,
  } = input;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber, input.pageSize);

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

    case 'get': {
      if (!applicationId) {
        return errorResponse('BAD_REQUEST', 'applicationId is required for get action');
      }
      const guidError = validateGuid(applicationId, 'applicationId');
      if (guidError) return guidError;
      return client.get('Application/ApplicationGetById', { applicationId });
    }

    case 'research': {
      if (!applicationId) {
        return errorResponse('BAD_REQUEST', 'applicationId is required for research action');
      }
      const guidError = validateGuid(applicationId, 'applicationId');
      if (guidError) return guidError;
      return client.get('Application/ApplicationGetResearchDetailsById', { applicationId });
    }

    case 'files': {
      if (!applicationId) {
        return errorResponse('BAD_REQUEST', 'applicationId is required for files action');
      }
      const guidError = validateGuid(applicationId, 'applicationId');
      if (guidError) return guidError;
      return client.get('ApplicationFile/ApplicationFileGetByApplicationId', {
        applicationId,
        searchText,
        pageNumber: String(pageNumber),
        pageSize: String(pageSize),
      });
    }

    case 'match': {
      if (hash) {
        const hashError = validateSha256(hash, 'hash');
        if (hashError) return hashError;
      }
      return client.post('Application/ApplicationGetMatchingList', {
        osType,
        hash: hash || '',
        path: path || '',
        processPath: processPath || '',
        sha256: hash || '',
        certs: certSha || cert ? [{ sha: certSha || '', subject: cert || '', validCert: true }] : [],
        createdBys: createdBy ? [createdBy] : [],
      });
    }

    case 'get_for_maintenance':
      return client.get('Application/ApplicationGetForMaintenanceMode', {});

    case 'get_for_network_policy': {
      if (!applicationId) {
        return errorResponse('BAD_REQUEST', 'applicationId is required for get_for_network_policy action');
      }
      const guidError = validateGuid(applicationId, 'applicationId');
      if (guidError) return guidError;
      return client.get('Application/ApplicationGetForNetworkPolicyProcessById', { applicationId });
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const applicationsZodSchema = {
  action: z.enum(['search', 'get', 'research', 'files', 'match', 'get_for_maintenance', 'get_for_network_policy']).describe('Action to perform'),
  applicationId: z.string().max(100).optional().describe('Application ID (required for get, research, files, get_for_network_policy)'),
  searchText: z.string().max(1000).optional().describe('Search text for search and files actions'),
  searchBy: z.enum(['app', 'full', 'process', 'hash', 'cert', 'created', 'categories', 'countries']).optional().describe('Field to search by (default: app)'),
  osType: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).optional().describe('OS type: 0=All, 1=Windows, 2=macOS, 3=Linux, 5=Windows XP'),
  category: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional().describe('Category: 0=All, 1=My Applications (Custom), 2=Built-In'),
  orderBy: z.enum(['name', 'date-created', 'review-rating', 'computer-count', 'policy']).optional().describe('Field to sort by (default: name)'),
  isAscending: z.boolean().optional().describe('Sort ascending (default: true)'),
  includeChildOrganizations: z.boolean().optional().describe('Include child organization applications (default: false)'),
  isHidden: z.boolean().optional().describe('Include hidden/temporary applications (default: false)'),
  permittedApplications: z.boolean().optional().describe('Only show apps with active permit policies (default: false)'),
  countries: z.array(z.string().max(10)).max(20).optional().describe('ISO country codes to filter by (use with searchBy=countries)'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25)'),
  hash: z.string().max(500).optional().describe('SHA256 hash for match action'),
  path: z.string().max(1000).optional().describe('Full file path for match action'),
  processPath: z.string().max(1000).optional().describe('Process path for match action'),
  cert: z.string().max(500).optional().describe('Certificate subject for match action'),
  certSha: z.string().max(500).optional().describe('Certificate SHA for match action'),
  createdBy: z.string().max(1000).optional().describe('Created by path for match action'),
};

export const applicationsTool: ToolDefinition = {
  name: applicationsToolSchema.name,
  description: applicationsToolSchema.description,
  inputSchema: applicationsToolSchema.inputSchema,
  zodSchema: applicationsZodSchema,
  handler: handleApplicationsTool as ToolDefinition['handler'],
};
