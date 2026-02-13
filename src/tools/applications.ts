import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid, validateSha256, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof applicationsZodSchema>>;

export async function handleApplicationsTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
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
  } = input as ToolInput;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber as number | undefined, input.pageSize as number | undefined);

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
  action: z.enum(['search', 'get', 'research', 'files', 'match', 'get_for_maintenance', 'get_for_network_policy']).describe('search=find applications, get=details by ID, research=ThreatLocker security analysis, files=list file rules in app, match=find apps by file hash/cert/path, get_for_maintenance=apps for maintenance mode, get_for_network_policy=app for network policy'),
  applicationId: z.string().max(100).optional().describe('Application GUID (required for get, research, files, get_for_network_policy). Find via search action first.'),
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
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
  hash: z.string().max(500).optional().describe('SHA256 hash for match action'),
  path: z.string().max(1000).optional().describe('Full file path for match action'),
  processPath: z.string().max(1000).optional().describe('Process path for match action'),
  cert: z.string().max(500).optional().describe('Certificate subject for match action'),
  certSha: z.string().max(500).optional().describe('Certificate SHA for match action'),
  createdBy: z.string().max(1000).optional().describe('Created by path for match action'),
};

const applicationObject = z.object({
  applicationId: z.string(),
  name: z.string(),
  osType: z.number(),
  computerCount: z.number(),
  policyCount: z.number(),
}).passthrough();

const researchObject = z.object({
  productName: z.string(),
  productDescription: z.string(),
  concernRating: z.number(),
  reviewRating: z.number(),
  categories: z.array(z.string()),
  countriesWhereCodeCompiled: z.array(z.string()),
}).passthrough();

export const applicationsOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(applicationObject).describe('search/match/get_for_maintenance: array of applications'),
    applicationObject.describe('get/get_for_network_policy: single application'),
    researchObject.describe('research: ThreatLocker security analysis'),
    z.array(z.object({
      fullPath: z.string(),
      hash: z.string(),
      cert: z.string(),
    }).passthrough()).describe('files: array of file rules'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const applicationsTool: ToolDefinition = {
  name: 'applications',
  title: 'ThreatLocker Applications',
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

Permissions: Edit Application Control Applications.
Pagination: search and files actions are paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: applicationId, name, osType, computerCount, policyCount. Research fields: concernRating, reviewRating, categories, countriesWhereCodeCompiled.

Related tools: policies (see policies using this app), action_log (see app activity), approval_requests (pending approvals for this app)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: applicationsZodSchema,
  outputZodSchema: applicationsOutputZodSchema,
  handler: handleApplicationsTool,
};
