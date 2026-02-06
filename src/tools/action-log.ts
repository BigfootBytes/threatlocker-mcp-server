import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination } from '../types/responses.js';

export const actionLogToolSchema = {
  name: 'action_log',
  description: `Query ThreatLocker unified audit logs.

The action log records all application control events: permits, denies, network access, file operations, PowerShell execution, elevation requests, and more. This is your primary tool for investigating what happened on endpoints.

Common workflows:
- Find all denies in last 24 hours: action=search, startDate="...", endDate="...", actionId=99
- Find denies on a specific computer: action=search, ..., hostname="COMPUTER-NAME"
- Find network blocks: action=search, ..., actionType=network, actionId=2
- Find PowerShell executions: action=search, ..., actionType=powershell
- Get details of a specific event: action=get, actionLogId="..."
- Track a file's history across all computers: action=file_history, fullPath="C:\\path\\to\\file.exe"
- Aggregate by user to find who's triggering denies: action=search, ..., groupBys=[1]
- Get file download details: action=get_file_download, actionLogId="..."
- Get policy conditions for permit: action=get_policy_conditions, actionLogId="..."
- Get testing environment details: action=get_testing_details, actionLogId="..."

Related tools: computers (find computer IDs), applications (identify apps), approval_requests (handle denied software)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['search', 'get', 'file_history', 'get_file_download', 'get_policy_conditions', 'get_testing_details'],
        description: 'search=query logs with filters, get=single event details, file_history=all events for a file path, get_file_download=file download info, get_policy_conditions=policy conditions for permit, get_testing_details=testing environment details',
      },
      startDate: {
        type: 'string',
        description: 'Start of date range (required for search). ISO 8601 UTC format: 2025-01-01T00:00:00Z',
      },
      endDate: {
        type: 'string',
        description: 'End of date range (required for search). ISO 8601 UTC format: 2025-01-31T23:59:59Z',
      },
      actionId: {
        type: 'number',
        enum: [1, 2, 99],
        description: 'Filter by result: 1=Permit only, 2=Deny only, 99=Any Deny (includes ringfence denies)',
      },
      actionType: {
        type: 'string',
        enum: ['execute', 'install', 'network', 'registry', 'read', 'write', 'move', 'delete', 'baseline', 'powershell', 'elevate', 'configuration', 'dns'],
        description: 'Filter by event type: execute=app launch, install=MSI/setup, network=firewall, registry=reg access, read/write/move/delete=storage control, powershell=script execution, elevate=admin requests, dns=DNS queries',
      },
      hostname: {
        type: 'string',
        description: 'Filter by computer name. Supports wildcards: "*SERVER*", "WKS-*"',
      },
      actionLogId: {
        type: 'string',
        description: 'Event GUID (required for get action). Get from search results.',
      },
      fullPath: {
        type: 'string',
        description: 'Filter by file path. Supports wildcards: "*\\chrome.exe", "C:\\Users\\*\\Downloads\\*"',
      },
      computerId: {
        type: 'string',
        description: 'Scope file_history to one computer. Get ID from computers tool.',
      },
      showChildOrganizations: {
        type: 'boolean',
        description: 'Include logs from child organizations (MSP/enterprise view).',
      },
      onlyTrueDenies: {
        type: 'boolean',
        description: 'Exclude simulated denies (monitor mode). Shows only actual blocks.',
      },
      groupBys: {
        type: 'array',
        items: { type: 'number' },
        description: 'Aggregate results by field(s): 1=Username, 2=Process Path, 6=Policy Name, 8=Application Name, 9=Action Type, 17=Asset Name (computer), 70=Risk Score. Useful for summarizing patterns.',
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

interface ActionLogInput {
  action?: 'search' | 'get' | 'file_history' | 'get_file_download' | 'get_policy_conditions' | 'get_testing_details';
  startDate?: string;
  endDate?: string;
  actionId?: number;
  actionType?: string;
  hostname?: string;
  actionLogId?: string;
  fullPath?: string;
  computerId?: string;
  showChildOrganizations?: boolean;
  onlyTrueDenies?: boolean;
  groupBys?: number[];
  pageNumber?: number;
  pageSize?: number;
}

export async function handleActionLogTool(
  client: ThreatLockerClient,
  input: ActionLogInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    startDate,
    endDate,
    actionId,
    actionType,
    hostname,
    actionLogId,
    fullPath,
    computerId,
    showChildOrganizations = false,
    onlyTrueDenies = false,
    groupBys = [],
  } = input;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber, input.pageSize);

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'search':
      if (!startDate || !endDate) {
        return errorResponse('BAD_REQUEST', 'startDate and endDate are required for search action');
      }
      return client.post(
        'ActionLog/ActionLogGetByParametersV2',
        {
          startDate,
          endDate,
          pageNumber,
          pageSize,
          actionId,
          actionType,
          hostname,
          fullPath,
          paramsFieldsDto: [],
          groupBys,
          exportMode: false,
          showTotalCount: true,
          showChildOrganizations,
          onlyTrueDenies,
          simulateDeny: false,
        },
        extractPaginationFromHeaders,
        { usenewsearch: 'true' }
      );

    case 'get':
      if (!actionLogId) {
        return errorResponse('BAD_REQUEST', 'actionLogId is required for get action');
      }
      return client.get('ActionLog/ActionLogGetByIdV2', { actionLogId });

    case 'file_history': {
      if (!fullPath) {
        return errorResponse('BAD_REQUEST', 'fullPath is required for file_history action');
      }
      const params: Record<string, string> = { fullPath };
      if (computerId) {
        params.computerId = computerId;
      }
      return client.get('ActionLog/ActionLogGetAllForFileHistoryV2', params);
    }

    case 'get_file_download':
      if (!actionLogId) {
        return errorResponse('BAD_REQUEST', 'actionLogId is required for get_file_download action');
      }
      return client.get('ActionLog/ActionLogGetFileDownloadDetailsById', { actionLogId });

    case 'get_policy_conditions':
      if (!actionLogId) {
        return errorResponse('BAD_REQUEST', 'actionLogId is required for get_policy_conditions action');
      }
      return client.post('ActionLog/ActionLogGetPolicyConditionsForPermitApplication', { actionLogId });

    case 'get_testing_details':
      if (!actionLogId) {
        return errorResponse('BAD_REQUEST', 'actionLogId is required for get_testing_details action');
      }
      return client.post('ActionLog/ActionLogGetTestingEnvironmentDetailsById', { actionLogId });

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
