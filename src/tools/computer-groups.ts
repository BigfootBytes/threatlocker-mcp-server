import { z } from 'zod';
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse, validateGuid, validateInstallKey, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
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
  action: z.enum(['list', 'dropdown', 'dropdown_with_org', 'get_for_permit', 'get_by_install_key']).describe('list=full details with computers, dropdown=simple list for selection, dropdown_with_org=includes parent/child orgs, get_for_permit=groups for approval workflow, get_by_install_key=get group by 24-char install key'),
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
  computerGroupId: z.string().max(100).optional().describe('Filter by specific computer group GUID (list action)'),
  hideGlobals: z.boolean().optional().describe('Hide global groups (dropdown action)'),
  includeAvailableOrganizations: z.boolean().optional().describe('Include child and parent organizations (dropdown_with_org action)'),
  includeAllPolicies: z.boolean().optional().describe('Include all policies attached to groups (list action)'),
  installKey: z.string().length(24).optional().describe('24-character install key (required for get_by_install_key)'),
};

const dropdownItem = z.object({
  label: z.string(),
  value: z.string(),
}).passthrough();

const permitGroupObject = z.object({
  computerGroupId: z.string(),
  name: z.string(),
  organizationId: z.string(),
  osType: z.number(),
}).passthrough();

export const computerGroupsOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(z.object({ label: z.string(), value: z.string() }).passthrough()).describe('list: array of groups with label/value and nested items'),
    z.array(dropdownItem).describe('dropdown: array of dropdown items'),
    z.object({}).passthrough().describe('dropdown_with_org: object with organizations array'),
    z.array(permitGroupObject).describe('get_for_permit: array of groups for approval workflow'),
    z.object({}).passthrough().describe('get_by_install_key: single group'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const computerGroupsTool: ToolDefinition = {
  name: 'computer_groups',
  title: 'ThreatLocker Computer Groups',
  description: `List and inspect ThreatLocker computer groups.

Computer groups organize computers and define policy scope. Policies are applied to groups, not individual computers. The "global" group (includeGlobal=true) permits applications across all groups.

Common workflows:
- Get all groups with computers: action=list, includeAllComputers=true
- Get group dropdown for UI/selection: action=dropdown
- Get groups across organizations (MSP): action=dropdown_with_org, includeAvailableOrganizations=true
- Filter by OS type: osType=1 (Windows), 2 (macOS), 3 (Linux)
- Get groups for approval workflow: action=get_for_permit
- Get group by install key: action=get_by_install_key, installKey="..."

Permissions: Super Admin (for list), Edit Computers, Edit Computer Groups, View Computers.
Key response fields: computerGroupId, name, osType, computerCount, organizationId.

Related tools: computers (list computers in groups), policies (policies applied to groups)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: computerGroupsZodSchema,
  outputZodSchema: computerGroupsOutputZodSchema,
  handler: handleComputerGroupsTool,
};
