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

    case 'create': {
      const appName = input.name as string | undefined;
      const appDescription = input.description as string | undefined;
      if (!appName) {
        return errorResponse('BAD_REQUEST', 'name is required for create action');
      }
      return client.post('Application/ApplicationInsert', {
        name: appName,
        osType,
        description: appDescription || '',
        applicationFileUpdates: [],
      });
    }

    case 'update': {
      const appName = input.name as string | undefined;
      const appDescription = input.description as string | undefined;
      if (!applicationId) {
        return errorResponse('BAD_REQUEST', 'applicationId is required for update action');
      }
      const guidError = validateGuid(applicationId, 'applicationId');
      if (guidError) return guidError;
      if (!appName) {
        return errorResponse('BAD_REQUEST', 'name is required for update action');
      }
      return client.put('Application/ApplicationUpdateById', {
        applicationId,
        name: appName,
        osType,
        description: appDescription || '',
      });
    }

    case 'add_file': {
      if (!applicationId) {
        return errorResponse('BAD_REQUEST', 'applicationId is required for add_file action');
      }
      const guidError = validateGuid(applicationId, 'applicationId');
      if (guidError) return guidError;

      const fileRules = input.fileRules as Array<Record<string, string>> | undefined;
      if (!fileRules || fileRules.length === 0) {
        return errorResponse('BAD_REQUEST', 'fileRules array is required for add_file action');
      }

      const results: Array<{ success: boolean; applicationFileId?: unknown; fullPath?: string; hash?: string; error?: string }> = [];
      for (const rule of fileRules) {
        try {
          const ruleHash = rule.hash || '';
          const isHashOnly = !!ruleHash && !rule.fullPath && !rule.cert && !rule.processPath;
          // Match the portal's minimal PrepareForInsert payload shape
          const filePayload: Record<string, unknown> = {
            applicationFileId: 0,
            applicationId,
            osType,
            status: 1,
            isHashOnly,
            expanded: false,
            unsavedChanges: false,
          };
          if (rule.fullPath) filePayload.fullPath = rule.fullPath;
          if (rule.cert) filePayload.cert = rule.cert;
          if (ruleHash) filePayload.hash = ruleHash;
          if (rule.processPath) filePayload.processPath = rule.processPath;
          if (rule.installedBy) filePayload.installedBy = rule.installedBy;
          if (rule.notes) filePayload.notes = rule.notes;

          // Step 1: Prepare — validates the rule and auto-generates notes/timestamp
          const prepareResult = await client.post<Record<string, unknown>>(
            'ApplicationFile/ApplicationFilePrepareForInsert',
            filePayload
          );
          if (!prepareResult.success) {
            results.push({ success: false, fullPath: rule.fullPath, hash: rule.hash, error: prepareResult.error.message });
            continue;
          }

          // Step 2: Insert — commits the prepared object
          const insertResult = await client.post<Record<string, unknown>>(
            'ApplicationFile/ApplicationFileInsert',
            prepareResult.data
          );
          if (!insertResult.success) {
            results.push({ success: false, fullPath: rule.fullPath, hash: rule.hash, error: insertResult.error.message });
            continue;
          }
          const inserted = insertResult.data;
          results.push({
            success: true,
            applicationFileId: inserted?.applicationFileId,
            fullPath: (inserted?.fullPath as string) || rule.fullPath,
            hash: (inserted?.hash as string) || rule.hash,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          results.push({ success: false, fullPath: rule.fullPath, hash: rule.hash, error: message });
        }
      }

      return {
        success: true,
        data: {
          total: results.length,
          succeeded: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results,
        },
      };
    }

    case 'remove_file': {
      if (!applicationId) {
        return errorResponse('BAD_REQUEST', 'applicationId is required for remove_file action');
      }
      const guidError = validateGuid(applicationId, 'applicationId');
      if (guidError) return guidError;

      const fileIds = input.applicationFileIds as number[] | undefined;
      if (!fileIds || fileIds.length === 0) {
        return errorResponse('BAD_REQUEST', 'applicationFileIds array is required for remove_file action');
      }

      // Fetch all file rules for this application to get the full objects needed by the delete endpoint
      const filesResult = await client.get<Array<Record<string, unknown>>>(
        'ApplicationFile/ApplicationFileGetByApplicationId',
        { applicationId, pageNumber: '1', pageSize: '500' }
      );
      if (!filesResult.success) {
        return errorResponse('BAD_REQUEST', `Failed to fetch file rules: ${filesResult.error.message}`);
      }

      const allFiles = Array.isArray(filesResult.data) ? filesResult.data : [];
      const fileMap = new Map(allFiles.map(f => [f.applicationFileId as number, f]));

      const results: Array<{ success: boolean; applicationFileId: number; error?: string }> = [];
      for (const fileId of fileIds) {
        try {
          const fileObj = fileMap.get(fileId);
          if (!fileObj) {
            results.push({ success: false, applicationFileId: fileId, error: `File rule ${fileId} not found in application` });
            continue;
          }

          const deleteResult = await client.post(
            'ApplicationFile/ApplicationFileDeleteById',
            fileObj
          );
          if (!deleteResult.success) {
            results.push({ success: false, applicationFileId: fileId, error: deleteResult.error.message });
            continue;
          }
          results.push({ success: true, applicationFileId: fileId });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          results.push({ success: false, applicationFileId: fileId, error: message });
        }
      }

      return {
        success: true,
        data: {
          total: results.length,
          succeeded: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results,
        },
      };
    }

    case 'delete':
    case 'delete_confirm': {
      const apps = input.applications as Array<{ applicationId: string; name: string; organizationId: string; osType: number }> | undefined;
      if (!apps || apps.length === 0) {
        return errorResponse('BAD_REQUEST', 'applications array is required for delete action');
      }
      for (const app of apps) {
        const appIdError = validateGuid(app.applicationId, 'applicationId');
        if (appIdError) return appIdError;
        const orgIdError = validateGuid(app.organizationId, 'organizationId');
        if (orgIdError) return orgIdError;
      }
      const endpoint = action === 'delete'
        ? 'Application/ApplicationUpdateForDelete'
        : 'Application/ApplicationConfirmUpdateForDelete';
      return client.post(endpoint, { applications: apps });
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const applicationsZodSchema = {
  action: z.enum(['search', 'get', 'research', 'files', 'match', 'get_for_maintenance', 'get_for_network_policy', 'create', 'update', 'add_file', 'remove_file', 'delete', 'delete_confirm']).describe('search=find applications, get=details by ID, research=ThreatLocker security analysis, files=list file rules in app, match=find apps by file hash/cert/path, get_for_maintenance=apps for maintenance mode, get_for_network_policy=app for network policy, create=create custom application (metadata only), update=update app name/description, add_file=add file rules to application, remove_file=remove file rules by ID, delete=delete applications (no policies), delete_confirm=force delete (with policies)'),
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
  name: z.string().max(200).optional().describe('Application name (required for create, update)'),
  description: z.string().max(2000).optional().describe('Application description'),
  fileRules: z.array(z.object({
    fullPath: z.string().max(1000).optional().describe('Full file path'),
    processPath: z.string().max(1000).optional().describe('Process path'),
    installedBy: z.string().max(1000).optional().describe('Installed by path'),
    cert: z.string().max(500).optional().describe('Certificate subject'),
    hash: z.string().max(500).optional().describe('SHA256 hash'),
    notes: z.string().max(2000).optional().describe('Notes'),
  })).max(50).optional().describe('File rules for add_file action. Each defines a matching condition (hash, path, cert, etc.). Processed via two-step prepare+insert API.'),
  applicationFileIds: z.array(z.number()).min(1).max(50).optional().describe('File rule IDs to remove (required for remove_file). Get IDs via action=files first.'),
  applications: z.array(z.object({
    applicationId: z.string().max(100),
    name: z.string().max(200),
    organizationId: z.string().max(100),
    osType: z.number(),
  })).min(1).max(50).optional().describe('Applications to delete (required for delete/delete_confirm). Get details via get action first.'),
};

const applicationObject = z.object({
  applicationId: z.string(),
  name: z.string(),
  osType: z.number(),
  isBuiltIn: z.boolean(),
  computerCounts: z.number(),
  reviewRating: z.number().nullable(),
  concernRating: z.number().nullable(),
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
    z.array(applicationObject).describe('search/get_for_maintenance: array of applications'),
    z.object({ matchingApplications: z.array(z.object({}).passthrough()), hasMatching: z.boolean() }).passthrough().describe('match: matching applications result'),
    applicationObject.describe('get/get_for_network_policy: single application'),
    researchObject.describe('research: ThreatLocker security analysis'),
    z.array(z.object({
      fullPath: z.string(),
      hash: z.string(),
      cert: z.string(),
    }).passthrough()).describe('files: array of file rules'),
    applicationObject.describe('create/update: created or updated application'),
    z.any().describe('delete/delete_confirm: deletion result'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const applicationsTool: ToolDefinition = {
  name: 'applications',
  title: 'ThreatLocker Applications',
  description: `Search, inspect, create, update, and delete ThreatLocker applications.

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
- Create custom application: action=create, name="My App", osType=1
- Update application metadata: action=update, applicationId="...", name="...", osType=1
- Add file rules to application: action=add_file, applicationId="...", osType=1, fileRules=[{hash:"..."}, {fullPath:"...", cert:"..."}]
- Remove file rules from application: action=remove_file, applicationId="...", applicationFileIds=[7111524894, 7111524907] (get IDs via action=files)
- Delete application (no policies): action=delete, applications=[{applicationId:"...", name:"...", organizationId:"...", osType:1}]
- Force delete (with policies): action=delete_confirm, applications=[...]

Permissions: Edit Application Control Applications.
Pagination: search and files actions are paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: applicationId, name, osType, computerCount, policyCount. Research fields: concernRating, reviewRating, categories, countriesWhereCodeCompiled.

Related tools: policies (see policies using this app), action_log (see app activity), approval_requests (pending approvals for this app)`,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  zodSchema: applicationsZodSchema,
  outputZodSchema: applicationsOutputZodSchema,
  handler: handleApplicationsTool,
  writeActions: new Set(['create', 'update', 'add_file', 'remove_file', 'delete', 'delete_confirm']),
};
