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
    isAscending = false,
    showChildOrganizations = false,
    showCurrentTierOnly = false,
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
          showCurrentTierOnly,
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

    case 'reject': {
      if (!approvalRequestId) {
        return errorResponse('BAD_REQUEST', 'approvalRequestId is required for reject action');
      }
      const guidError = validateGuid(approvalRequestId, 'approvalRequestId');
      if (guidError) return guidError;
      return client.post('ApprovalRequest/ApprovalRequestUpdateForReject', {
        approvalRequestDtos: [{ approvalRequestId }],
        type: 'reject',
        rejectReason: (input.rejectReason as string | undefined) ?? '',
        responseSubject: input.responseSubject,
        responseReason: input.responseReason,
        notifyOnResponse: input.notifyOnResponse ?? false,
      });
    }

    case 'take_ownership': {
      if (!approvalRequestId) {
        return errorResponse('BAD_REQUEST', 'approvalRequestId is required for take_ownership action');
      }
      const guidError = validateGuid(approvalRequestId, 'approvalRequestId');
      if (guidError) return guidError;
      return client.post('ApprovalRequest/ApprovalRequestUpdateForTakeOwnership', { approvalRequestId });
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

    case 'permit': {
      const permitJson = input.permitJson as string | undefined;
      const computerId = input.computerId as string | undefined;
      const computerGroupId = input.computerGroupId as string | undefined;
      const orgId = input.organizationId as string | undefined;
      const organizationIds = input.organizationIds as string[] | undefined;
      const osTypeVal = input.osType as number | undefined;
      const fullPath = input.fullPath as string | undefined;
      const permitMode = input.permitMode as string | undefined;
      const policyLevelVal = input.policyLevel as string | undefined;
      const ruleId = input.ruleId as number | undefined;
      const ringfenceActionId = input.ringfenceActionId as number | undefined;

      if (!approvalRequestId) return errorResponse('BAD_REQUEST', 'approvalRequestId is required for permit action');
      const arGuid = validateGuid(approvalRequestId, 'approvalRequestId'); if (arGuid) return arGuid;
      if (!permitJson) return errorResponse('BAD_REQUEST', 'permitJson is required for permit action (round-trip it verbatim from get_permit_application)');
      if (!computerId) return errorResponse('BAD_REQUEST', 'computerId is required for permit action');
      const cGuid = validateGuid(computerId, 'computerId'); if (cGuid) return cGuid;
      if (!computerGroupId) return errorResponse('BAD_REQUEST', 'computerGroupId is required for permit action');
      const cgGuid = validateGuid(computerGroupId, 'computerGroupId'); if (cgGuid) return cgGuid;
      if (!orgId) return errorResponse('BAD_REQUEST', 'organizationId is required for permit action');
      const oGuid = validateGuid(orgId, 'organizationId'); if (oGuid) return oGuid;
      if (!organizationIds || organizationIds.length === 0) return errorResponse('BAD_REQUEST', 'organizationIds is required for permit action');
      for (const id of organizationIds) { const g = validateGuid(id, 'organizationIds[]'); if (g) return g; }
      if (!osTypeVal) return errorResponse('BAD_REQUEST', 'osType is required for permit action (1=Windows, 2=macOS, 3=Linux, 5=Windows XP)');
      if (!fullPath) return errorResponse('BAD_REQUEST', 'fullPath is required for permit action');
      if (!permitMode) return errorResponse('BAD_REQUEST', 'permitMode is required for permit action (existing_app|matching_app|new_app)');
      if (!policyLevelVal) return errorResponse('BAD_REQUEST', 'policyLevel is required for permit action (organization|computer_group|computer)');
      if (ruleId === undefined) return errorResponse('BAD_REQUEST', 'ruleId is required for permit action (0-3)');
      if (ringfenceActionId === undefined) return errorResponse('BAD_REQUEST', 'ringfenceActionId is required for permit action');

      // App selection — handler sets the mutually-exclusive booleans so two modes can never both be true.
      const appOrgId = (input.applicationOrganizationId as string | undefined) || orgId;
      const applicationName = input.applicationName as string | undefined;
      const appId = input.applicationId as string | undefined;
      const newApplicationName = input.newApplicationName as string | undefined;

      const matchingApplications: Record<string, unknown> = {
        useMatchingApplication: false,
        useExistingApplication: false,
        useNewApplication: false,
      };
      if (permitMode === 'matching_app' || permitMode === 'existing_app') {
        if (!appId) return errorResponse('BAD_REQUEST', `applicationId is required when permitMode=${permitMode}`);
        const aGuid = validateGuid(appId, 'applicationId'); if (aGuid) return aGuid;
        if (!applicationName) return errorResponse('BAD_REQUEST', `applicationName is required when permitMode=${permitMode}`);
        const appObj = { applicationName, applicationId: appId, organizationId: appOrgId, osType: osTypeVal };
        if (permitMode === 'matching_app') {
          matchingApplications.useMatchingApplication = true;
          matchingApplications.matchingApplication = appObj;
        } else {
          matchingApplications.useExistingApplication = true;
          matchingApplications.existingApplication = appObj;
        }
      } else if (permitMode === 'new_app') {
        if (!newApplicationName) return errorResponse('BAD_REQUEST', 'newApplicationName is required when permitMode=new_app');
        matchingApplications.useNewApplication = true;
        matchingApplications.newApplicationName = newApplicationName;
      } else {
        return errorResponse('BAD_REQUEST', `Unknown permitMode: ${permitMode} (use existing_app|matching_app|new_app)`);
      }

      // Policy level — exactly one branch true.
      const policyLevel: Record<string, unknown> = {
        toEntireOrganization: false,
        toComputerGroup: false,
        toComputer: false,
      };
      if (policyLevelVal === 'organization') {
        policyLevel.toEntireOrganization = true;
      } else if (policyLevelVal === 'computer') {
        policyLevel.toComputer = true;
      } else if (policyLevelVal === 'computer_group') {
        policyLevel.toComputerGroup = true;
        policyLevel.selectedComputerGroup = { computerGroupId, organizationId: orgId, osType: osTypeVal };
      } else {
        return errorResponse('BAD_REQUEST', `Unknown policyLevel: ${policyLevelVal} (use organization|computer_group|computer)`);
      }

      // manualOptions: a hash rule must contain ONLY the hash (KB: no other fields, no wildcards).
      const manualOptions = input.manualOptions as Array<Record<string, unknown>> | undefined;
      if (manualOptions) {
        for (const opt of manualOptions) {
          if (opt.hash) {
            const present = Object.keys(opt).filter(k => opt[k] !== undefined && opt[k] !== '');
            if (present.length > 1) {
              return errorResponse('BAD_REQUEST', 'A hash rule must contain only the hash field (no fullPath/cert/processPath/createdBy).');
            }
          }
        }
      }

      return client.post('ApprovalRequest/ApprovalRequestPermitApplication', {
        approvalRequest: {
          approvalRequestId,
          json: permitJson,
          comments: input.comments,
          requestorEmailAddress: input.requestorEmailAddress,
          ticketApprovalManager: input.ticketApprovalManager,
          ticketId: input.ticketId,
        },
        computerId,
        computerGroupId,
        organizationId: orgId,
        organizationIds,
        osType: osTypeVal,
        fileDetails: { fullPath },
        matchingApplications,
        policyLevel,
        policyConditions: {
          useExistingPolicy: input.useExistingPolicy ?? false,
          manualOptions: manualOptions ?? [],
          ruleId,
        },
        ringfenceActionId,
        organizationHasElevation: true,
        elevationStatus: input.elevationStatus,
        elevationExpiration: input.elevationExpiration,
        networkExclusions: input.networkExclusions,
        policyExpirationDate: input.policyExpirationDate,
      });
    }

    case 'ignore': {
      if (!approvalRequestId) return errorResponse('BAD_REQUEST', 'approvalRequestId is required for ignore action');
      const guidError = validateGuid(approvalRequestId, 'approvalRequestId');
      if (guidError) return guidError;
      return client.post('ApprovalRequest/ApprovalRequestUpdateForIgnore', {
        approvalRequestDtos: [{ approvalRequestId }],
        type: 'ignore',
        ignoreReason: (input.ignoreReason as string | undefined) ?? '',
        ignoreSubject: input.ignoreSubject,
        responseSubject: input.responseSubject,
        responseReason: input.responseReason,
        notifyOnIgnore: input.notifyOnIgnore ?? false,
      });
    }

    case 'permit_storage': {
      const storageJson = input.storageJson as string | undefined;
      const storageMode = input.storageMode as string | undefined;
      if (!approvalRequestId) return errorResponse('BAD_REQUEST', 'approvalRequestId is required for permit_storage action');
      const arGuid = validateGuid(approvalRequestId, 'approvalRequestId');
      if (arGuid) return arGuid;
      if (!storageJson) return errorResponse('BAD_REQUEST', 'storageJson is required for permit_storage action (round-trip it verbatim from get_storage_approval)');
      if (!storageMode) return errorResponse('BAD_REQUEST', 'storageMode is required for permit_storage action (add_to_existing|new_policy)');

      const body: Record<string, unknown> = {
        approvalRequest: {
          approvalRequestId,
          json: storageJson,
          ticketId: input.ticketId,
          requestorEmailAddress: input.requestorEmailAddress,
          comments: input.comments,
        },
        json: storageJson,
        allStorageDevices: input.allStorageDevices ?? false,
        allFilePaths: input.allFilePaths ?? false,
        selectedPath: input.selectedPath,
        expirationDate: input.expirationDate,
        notifyOnResponse: input.notifyOnResponse ?? false,
      };

      if (storageMode === 'add_to_existing') {
        const storagePolicyId = input.storagePolicyId as string | undefined;
        if (!storagePolicyId) return errorResponse('BAD_REQUEST', 'storagePolicyId is required when storageMode=add_to_existing');
        const spGuid = validateGuid(storagePolicyId, 'storagePolicyId');
        if (spGuid) return spGuid;
        body.addDeviceToExisting = true;
        body.existingStoragePolicy = { storagePolicyId };
      } else if (storageMode === 'new_policy') {
        const policyName = input.policyName as string | undefined;
        if (!policyName) return errorResponse('BAD_REQUEST', 'policyName is required when storageMode=new_policy');
        body.addDeviceToExisting = false;
        body.policyName = policyName;
        body.entityType = input.entityType ?? 0;
        body.appliesToId = input.appliesToId;
      } else {
        return errorResponse('BAD_REQUEST', `Unknown storageMode: ${storageMode} (use add_to_existing|new_policy)`);
      }

      return client.post('ApprovalRequest/ApprovalRequestPermitStorageApproval', body);
    }

    case 'get_testing_environment': {
      if (!approvalRequestId) return errorResponse('BAD_REQUEST', 'approvalRequestId is required for get_testing_environment action');
      const guidError = validateGuid(approvalRequestId, 'approvalRequestId');
      if (guidError) return guidError;
      // Despite the VDIHyperV path, this returns file-download/testing-env details keyed off an approval request.
      return client.post('VDIHyperV/VDIHyperVGetTestingEnvironmentDetails', {
        approvalRequestId,
        sourceTableId: (input.sourceTableId as number | undefined) ?? 2,
      });
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const approvalRequestsZodSchema = {
  action: z.enum(['list', 'get', 'count', 'get_file_download_details', 'get_permit_application', 'get_storage_approval', 'reject', 'take_ownership', 'permit', 'ignore', 'permit_storage', 'get_testing_environment']).describe('list=search requests, get=single request details, count=pending count, get_file_download_details=file download info, get_permit_application=permit options, get_storage_approval=storage request details, reject=reject a pending request with a reason, take_ownership=assign a request to yourself, permit=approve an application request (round-trip the opaque json blob), ignore=ignore a request, permit_storage=approve a storage/USB request (round-trip get_storage_approval json), get_testing_environment=file/testing-env details for a request'),
  ignoreReason: z.string().max(2000).optional().describe('Reason shown to the requestor when ignoring (ignore action).'),
  ignoreSubject: z.string().max(500).optional().describe('Optional response email subject for ignore.'),
  notifyOnIgnore: z.boolean().optional().describe('Email the requestor on ignore (default: false).'),
  storageJson: z.string().optional().describe('permit_storage: the opaque "json" blob from get_storage_approval, passed back VERBATIM.'),
  storageMode: z.enum(['add_to_existing', 'new_policy']).optional().describe('permit_storage: add_to_existing=attach the device to an existing storage policy (needs storagePolicyId); new_policy=create a new storage policy (needs policyName).'),
  storagePolicyId: z.string().max(100).optional().describe('permit_storage: existing storage policy GUID (required for storageMode=add_to_existing).'),
  policyName: z.string().max(200).optional().describe('permit_storage: name for the new storage policy (required for storageMode=new_policy).'),
  entityType: z.number().optional().describe('permit_storage: scope level for a new policy (0=computer, 1=group, 2=org).'),
  appliesToId: z.string().max(100).optional().describe('permit_storage: entity GUID the new policy applies to.'),
  allStorageDevices: z.boolean().optional().describe('permit_storage: apply to all storage devices (default: false).'),
  allFilePaths: z.boolean().optional().describe('permit_storage: permit all file paths on the device (default: false); otherwise set selectedPath.'),
  selectedPath: z.string().max(2000).optional().describe('permit_storage: specific path to permit when allFilePaths=false.'),
  expirationDate: z.string().max(100).optional().describe('permit_storage: approval expiry in UTC (YYYY-MM-DDTHH:MM:SSZ).'),
  notifyOnResponse: z.boolean().optional().describe('Email the requestor on response (reject/permit_storage; default: false).'),
  sourceTableId: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional().describe('get_testing_environment: source log table (1=ActionLog, 2=DenyActionLog, 3=Baseline, 4=EventLog; default 2).'),
  permitJson: z.string().optional().describe('permit: the opaque "json" blob from get_permit_application, passed back VERBATIM. Do not synthesize or edit it.'),
  permitMode: z.enum(['existing_app', 'matching_app', 'new_app']).optional().describe('permit: existing_app=add file rule to an existing application; matching_app=use a ThreatLocker-matched application; new_app=create a new application. Requires applicationId+applicationName (existing/matching) or newApplicationName (new).'),
  policyLevel: z.enum(['organization', 'computer_group', 'computer']).optional().describe('permit: scope the resulting policy to the entire organization, the computer group, or just the requesting computer.'),
  computerId: z.string().max(100).optional().describe('permit: requesting computer GUID.'),
  computerGroupId: z.string().max(100).optional().describe('permit: computer group GUID (used as selectedComputerGroup when policyLevel=computer_group).'),
  organizationId: z.string().max(100).optional().describe('permit: organization GUID of the request.'),
  organizationIds: z.array(z.string().max(100)).optional().describe('permit: parent-hierarchy GUID chain (child→…→root); usually 1 entry for a child-org request.'),
  osType: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).optional().describe('permit: 1=Windows, 2=macOS, 3=Linux, 5=Windows XP.'),
  fullPath: z.string().max(2000).optional().describe('permit: file path of the requested file (use \\\\ for backslashes).'),
  applicationId: z.string().max(100).optional().describe('permit: application GUID (required for permitMode existing_app/matching_app).'),
  applicationName: z.string().max(200).optional().describe('permit: application name (required for permitMode existing_app/matching_app).'),
  applicationOrganizationId: z.string().max(100).optional().describe('permit: organization GUID that owns the application (defaults to organizationId).'),
  newApplicationName: z.string().max(200).optional().describe('permit: name for the new application (required for permitMode new_app).'),
  ruleId: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional().describe('permit: 0=manual rules, 1=Installation Mode 1hr, 2=Learning Mode 1hr, 3=Monitor Mode 1hr.'),
  ringfenceActionId: z.number().optional().describe('permit: ringfence action id applied to the permit.'),
  elevationStatus: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional().describe('permit: 0=do not elevate, 1=elevate, 2=silent elevation (only with the Elevation product).'),
  elevationExpiration: z.number().optional().describe('permit: elevation expiry in hours (used when elevationStatus>0).'),
  networkExclusions: z.array(z.object({
    tagPrefixTypeId: z.union([z.literal(1), z.literal(2), z.literal(3)]).describe('1=Domain, 2=IPv4, 3=IPv6'),
    value: z.string().max(500),
  })).optional().describe('permit: network exclusions applied to the resulting ringfence permit.'),
  policyExpirationDate: z.string().max(100).optional().describe('permit: expiry for the created policy in UTC (YYYY-MM-DDTHH:MM:SSZ).'),
  useExistingPolicy: z.boolean().optional().describe('permit: update an existing policy affecting the computer instead of creating one (default false).'),
  manualOptions: z.array(z.record(z.string(), z.string())).optional().describe('permit: file-rule conditions. A hash rule = { "hash": "..." } and NOTHING else. A property rule = any of { fullPath, cert, processPath, createdBy } (pair at least two for a stronger rule).'),
  comments: z.string().max(2000).optional().describe('permit: comment on the request. NOTE: overwrites any existing comment if provided.'),
  requestorEmailAddress: z.string().max(320).optional().describe('permit: requestor email. NOTE: overwrites existing value if provided.'),
  ticketApprovalManager: z.string().max(200).optional().describe('permit: approval manager. NOTE: overwrites existing value if provided.'),
  ticketId: z.string().max(200).optional().describe('permit: ticket id. NOTE: overwrites existing value if provided.'),
  rejectReason: z.string().max(2000).optional().describe('Reason shown to the requestor when rejecting (reject action).'),
  responseSubject: z.string().max(500).optional().describe('Optional response email subject for reject.'),
  responseReason: z.string().max(2000).optional().describe('Optional response email body for reject.'),
  approvalRequestId: z.string().max(100).optional().describe('Approval request GUID (required for get, get_file_download_details, get_permit_application, get_storage_approval). Find via list action first.'),
  statusId: z.union([z.literal(1), z.literal(4), z.literal(6), z.literal(10), z.literal(12), z.literal(13), z.literal(16)]).optional().describe('Filter by status: 1=Pending (default for list), 4=Approved, 6=Not Learned, 10=Ignored, 12=Added to Application, 13=Escalated, 16=Self-Approved'),
  searchText: z.string().max(1000).optional().describe('Filter by text'),
  orderBy: z.enum(['username', 'devicetype', 'actiontype', 'path', 'actiondate', 'datetime']).optional().describe('Field to order by (default: datetime)'),
  isAscending: z.boolean().optional().describe('Sort ascending. Default: false (newest-first), the right default for triaging the pending queue.'),
  showChildOrganizations: z.boolean().optional().describe('Include child organizations (default: false)'),
  showCurrentTierOnly: z.boolean().optional().describe('Only show requests at the current approval tier (multi-tier/MSP escalation; default: false)'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
};

const approvalRequestObject = z.object({
  approvalRequestId: z.string().nullable(),
  username: z.string().nullable(),
  hostname: z.string().nullable(),
  path: z.string().nullable(),
  statusId: z.number().describe('1=Pending, 4=Approved, 6=Not Learned, 10=Ignored, 12=Added, 13=Escalated, 16=Self-Approved, 17=Escalated by Customer'),
  actionType: z.string().nullable().optional(),
  requestorReason: z.string().nullable().optional().describe('Reason the end user gave for the request'),
  ticketId: z.string().nullable().optional(),
  isAssigned: z.boolean().optional().describe('Whether the request has been taken ownership of'),
  dateTime: z.string().nullable(),
  organizationId: z.string().nullable(),
  computerId: z.string().nullable(),
}).passthrough();

export const approvalRequestsOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(approvalRequestObject).describe('list: array of approval requests'),
    approvalRequestObject.describe('get/get_file_download_details/get_permit_application/get_storage_approval: single request'),
    z.number().describe('count: pending request count'),
    z.any().describe('permit/reject/take_ownership: write operation result'),
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
- Approve a request: action=permit. Two-step — call get_permit_application first, round-trip its opaque "json" blob into permitJson, then pick permitMode + policyLevel. Payload-verified, NOT live-tested: validate in a non-prod org before relying on it.

Request statuses: 1=Pending (needs review), 4=Approved, 6=Not Learned (learning mode), 10=Ignored, 12=Added to Application, 13=Escalated (from Cyber Heroes), 16=Self-Approved

Pitfalls:
- list defaults to newest-first (isAscending=false) — the right default for triaging the pending queue.
- Permitting a request is a two-step flow: call get_permit_application first and round-trip its opaque "json" blob; don't synthesize it.
- Before approving a Built-In matching app, confirm the file isn't a shared DLL matching unrelated apps (you'd permit the whole built-in).

Permissions: View Approvals, Approve for Entire Organization/Group/Single Computer.
Pagination: list action is paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: approvalRequestId, username, fullPath, actionType, statusId, computerName, requestDateTime.

Related tools: action_log (see the deny event), applications (find matching apps), policies (create permits)`,
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  zodSchema: approvalRequestsZodSchema,
  outputZodSchema: approvalRequestsOutputZodSchema,
  writeActions: new Set(['reject', 'take_ownership', 'permit', 'ignore', 'permit_storage']),
  handler: handleApprovalRequestsTool,
};
