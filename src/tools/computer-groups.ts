import { z } from 'zod';
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse, validateGuid, validateInstallKey } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof computerGroupsZodSchema>>;

export async function handleComputerGroupsTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const {
    action,
    osType = 0,
    includeGlobal = false,
    includeAllComputers = false,
    includeOrganizations = false,
    includeParentGroups = false,
    includeLoggedInObjects = false,
    includeDnsServers = false,
    includeIngestors = false,
    includeAccessDevices = false,
    includeRemovedComputers = false,
    computerGroupId,
    hideGlobals = false,
    includeAvailableOrganizations = false,
    includeAllPolicies = false,
    installKey,
  } = input as ToolInput;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list': {
      const params: Record<string, string> = {
        osType: String(osType),
        includeGlobal: String(includeGlobal),
        includeAllComputers: String(includeAllComputers),
        includeOrganizations: String(includeOrganizations),
        includeParentGroups: String(includeParentGroups),
        includeLoggedInObjects: String(includeLoggedInObjects),
        includeDnsServers: String(includeDnsServers),
        includeIngestors: String(includeIngestors),
        includeAccessDevices: String(includeAccessDevices),
        includeRemovedComputers: String(includeRemovedComputers),
        includeAllPolicies: String(includeAllPolicies),
      };
      if (computerGroupId) {
        const guidError = validateGuid(computerGroupId, 'computerGroupId');
        if (guidError) return guidError;
        params.computerGroupId = computerGroupId;
      }
      return client.get('ComputerGroup/ComputerGroupGetGroupAndComputer', params);
    }

    case 'dropdown':
      return client.get('ComputerGroup/ComputerGroupGetDropdownByOrganizationId', {
        computerGroupOSTypeId: String(osType),
        hideGlobals: String(hideGlobals),
      });

    case 'dropdown_with_org':
      return client.get('ComputerGroup/ComputerGroupGetDropdownWithOrganization', {
        includeAvailableOrganizations: String(includeAvailableOrganizations),
      });

    case 'get_for_permit':
      return client.get('ComputerGroup/ComputerGroupGetForPermitApplication', {});

    case 'get_by_install_key': {
      if (!installKey) {
        return errorResponse('BAD_REQUEST', 'installKey is required for get_by_install_key action');
      }
      const keyError = validateInstallKey(installKey);
      if (keyError) return keyError;
      return client.get('ComputerGroup/ComputerGroupGetForDownload', { installKey });
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const computerGroupsZodSchema = {
  action: z.enum(['list', 'dropdown', 'dropdown_with_org', 'get_for_permit', 'get_by_install_key']).describe('Action to perform'),
  osType: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).optional().describe('OS type: 0=All, 1=Windows, 2=macOS, 3=Linux, 5=Windows XP'),
  includeGlobal: z.boolean().optional().describe('Include global application-permitting group (list action)'),
  includeAllComputers: z.boolean().optional().describe('Include all computers in response (list action)'),
  includeOrganizations: z.boolean().optional().describe('Include accessible organizations (list action)'),
  includeParentGroups: z.boolean().optional().describe('Show parent computer groups (list action)'),
  includeLoggedInObjects: z.boolean().optional().describe('Add contextual path labels (list action)'),
  includeDnsServers: z.boolean().optional().describe('Include DNS servers (list action)'),
  includeIngestors: z.boolean().optional().describe('Include ingestors (list action)'),
  includeAccessDevices: z.boolean().optional().describe('Include access devices (list action)'),
  includeRemovedComputers: z.boolean().optional().describe('Include removed computers (list action)'),
  computerGroupId: z.string().max(100).optional().describe('Filter by specific computer group ID (list action)'),
  hideGlobals: z.boolean().optional().describe('Hide global groups (dropdown action)'),
  includeAvailableOrganizations: z.boolean().optional().describe('Include child and parent organizations (dropdown_with_org action)'),
  includeAllPolicies: z.boolean().optional().describe('Include all policies attached to groups (list action)'),
  installKey: z.string().max(500).optional().describe('24-character install key (required for get_by_install_key)'),
};

export const computerGroupsTool: ToolDefinition = {
  name: 'threatlocker_computer_groups',
  title: 'ThreatLocker Computer Groups',
  description: `List and inspect ThreatLocker computer groups.

Computer groups organize computers and define policy scope. Policies are applied to groups, not individual computers.

Common workflows:
- Get all groups with computers: action=list, includeAllComputers=true
- Get group dropdown for UI/selection: action=dropdown
- Get groups across organizations (MSP): action=dropdown_with_org, includeAvailableOrganizations=true
- Filter by OS type: osType=1 (Windows), 2 (macOS), 3 (Linux)
- Get groups for approval workflow: action=get_for_permit
- Get group by install key: action=get_by_install_key, installKey="..."

Related tools: computers (list computers in groups), policies (policies applied to groups)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: computerGroupsZodSchema,
  handler: handleComputerGroupsTool,
};
