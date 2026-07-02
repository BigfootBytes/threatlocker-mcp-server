import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof maintenanceModeZodSchema>>;

export async function handleMaintenanceModeTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const {
    action,
    computerId,
  } = input as ToolInput;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber as number | undefined, input.pageSize as number | undefined);

  if (!computerId) {
    return errorResponse('BAD_REQUEST', 'computerId is required for all maintenance_mode actions');
  }
  const guidError = validateGuid(computerId, 'computerId');
  if (guidError) return guidError;

  switch (action) {
    case 'get_history':
      return client.get('MaintenanceMode/MaintenanceModeGetByComputerIdV2', {
        computerId,
        pageNumber: String(pageNumber),
        pageSize: String(pageSize),
      });

    case 'enable': {
      const maintenanceTypeId = input.maintenanceTypeId as number | undefined;
      if (!maintenanceTypeId) {
        return errorResponse('BAD_REQUEST', 'maintenanceTypeId is required for enable action (1=MonitorOnly, 2=Installation, 3=Learning, 4=Elevation, 6=TamperProtectionDisabled, 14=Isolation, 15=Lockdown)');
      }
      return client.post('MaintenanceMode/MaintenanceModeInsert', {
        computerId,
        maintenanceTypeId,
        startDateTime: input.startDateTime,
        endDateTime: input.endDateTime,
        computerDateTime: input.startDateTime ?? input.endDateTime,
        allUsers: input.allUsers ?? true,
        usersList: input.usersList ?? [],
        permitEnd: input.permitEnd ?? true,
        automaticApplication: false,
        automaticApplicationType: 0,
        createNewApplication: false,
        useExistingApplication: false,
        ticketNumber: input.ticketNumber,
        notes: input.notes,
      });
    }

    case 'end': {
      const maintenanceModeId = input.maintenanceModeId as string | undefined;
      const maintenanceTypeId = input.maintenanceTypeId as number | undefined;
      if (!maintenanceModeId) {
        return errorResponse('BAD_REQUEST', 'maintenanceModeId is required for end action (get it from get_history)');
      }
      const mmGuidError = validateGuid(maintenanceModeId, 'maintenanceModeId');
      if (mmGuidError) return mmGuidError;
      if (!maintenanceTypeId) {
        return errorResponse('BAD_REQUEST', 'maintenanceTypeId is required for end action and must match the active mode');
      }
      return client.patch('MaintenanceMode/MaintenanceModeEndById', {
        computerId,
        maintenanceModeId,
        maintenanceTypeId,
      });
    }

    case 'update_end_time': {
      const maintenanceEndDate = input.maintenanceEndDate as string | undefined;
      const maintenanceTypeId = input.maintenanceTypeId as number | undefined;
      if (!maintenanceEndDate) {
        return errorResponse('BAD_REQUEST', 'maintenanceEndDate is required for update_end_time action (UTC YYYY-MM-DDTHH:MM:SSZ)');
      }
      if (!maintenanceTypeId) {
        return errorResponse('BAD_REQUEST', 'maintenanceTypeId is required for update_end_time action and MUST match the currently active mode (the API silently no-ops otherwise)');
      }
      return client.post('MaintenanceMode/MaintenanceModeUpdateEndDateTimeForSpecificDate', {
        computerId,
        maintenanceEndDate,
        maintenanceTypeId,
      });
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const maintenanceModeZodSchema = {
  action: z.enum(['get_history', 'enable', 'end', 'update_end_time']).describe('get_history=paginated history for a computer, enable=put a computer into a maintenance mode (MaintenanceModeInsert), end=end an active maintenance window early (MaintenanceModeEndById), update_end_time=extend/shorten an active window (maintenanceTypeId must match the active mode)'),
  maintenanceEndDate: z.string().max(100).optional().describe('New window end (UTC YYYY-MM-DDTHH:MM:SSZ) for update_end_time.'),
  computerId: z.string().max(100).describe('Computer GUID (required). Find via computers list first.'),
  maintenanceTypeId: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6), z.literal(14), z.literal(15), z.literal(16), z.literal(17), z.literal(18), z.literal(19)]).optional().describe('Maintenance type (required for enable/end): 1=MonitorOnly, 2=Installation, 3=Learning, 4=Elevation, 6=TamperProtectionDisabled, 14=Isolation, 15=Lockdown, 16=DisableOpsAlerts, 17=NetworkControlMonitorOnly, 18=StorageControlMonitorOnly, 19=InstallationLegacy. For end, must match the active mode.'),
  maintenanceModeId: z.string().max(100).optional().describe('Active maintenance window GUID (required for end). Get it from get_history.'),
  startDateTime: z.string().max(100).optional().describe('Window start (ISO 8601 UTC) for enable. Defaults to now if omitted.'),
  endDateTime: z.string().max(100).optional().describe('Window end (ISO 8601 UTC) for enable. Defaults to +1 hour if omitted.'),
  allUsers: z.boolean().optional().describe('Apply to all users (default: true). When false, supply usersList.'),
  usersList: z.array(z.string().max(200)).max(100).optional().describe('"DOMAIN\\\\USERNAME" entries; only used when allUsers=false.'),
  permitEnd: z.boolean().optional().describe('Re-secure automatically at window end (default: true).'),
  ticketNumber: z.string().max(200).optional().describe('Optional ticket reference recorded with the maintenance window.'),
  notes: z.string().max(2000).optional().describe('Optional notes recorded with the maintenance window.'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
};

const maintenanceModeObject = z.object({
  maintenanceModeId: z.string().nullable(),
  maintenanceTypeId: z.number().describe('1=ApplicationControlMonitorOnly, 2=ApplicationControlInstallationMode, 3=Learning, 4=Elevation, 6=TamperProtectionDisabled, 14=Isolation, 15=Lockdown, 16=DisableOpsAlerts, 17=NetworkControlMonitorOnly, 18=StorageControlMonitorOnly, 19=InstallationLegacy — see threatlocker://enums resource'),
  displayName: z.string().nullable().describe('Human-readable maintenance mode name'),
  startDateTime: z.string().nullable(),
  endDateTime: z.string().nullable(),
  addedBy: z.string().nullable().describe('Who enabled the maintenance window'),
  endedBy: z.string().nullable().describe('Who ended it early (empty if it ran to completion)'),
}).passthrough();

export const maintenanceModeOutputZodSchema = {
  success: z.boolean(),
  data: z.array(maintenanceModeObject).optional().describe('get_history: array of maintenance mode records'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const maintenanceModeTool: ToolDefinition = {
  name: 'maintenance_mode',
  title: 'ThreatLocker Maintenance Mode',
  description: `Query ThreatLocker maintenance mode history for computers.

Maintenance mode temporarily changes a computer's protection level. Types include:
- Monitor Only (1): Logs but doesn't block (audit mode)
- Installation Mode (2): Allows new software installs, auto-learns new applications
- Learning Mode (3): Monitors and records software usage without blocking
- Tamper Protection Disabled (6): Allows ThreatLocker service changes

Common workflows:
- View maintenance history for a computer: action=get_history, computerId="..."
- Audit who put computers in installation mode: check history across computers

Maintenance mode history shows who enabled it, when, duration, and what applications were learned during that time.

Pitfalls:
- Learning Mode (3) requires a "Default - (Group Name)" Default Deny policy to exist in the group, or it silently does nothing.
- Isolation (14) and Lockdown (15) require ThreatLocker Detect and Agent >= 8.2.
- usersList entries are "DOMAIN\\USERNAME" and only apply when allUsers=false; default window is 1 hour if no end time is given.

Permissions: Edit Computers, Manage Application Control Installation Mode, Manage Application Control Learning Mode.
Pagination: get_history is paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: maintenanceModeId, maintenanceTypeId, displayName, startDateTime, endDateTime, addedBy, endedBy.

Related tools: computers (get computer IDs, see current mode), computer_groups (group-level modes)`,
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  zodSchema: maintenanceModeZodSchema,
  outputZodSchema: maintenanceModeOutputZodSchema,
  writeActions: new Set(['enable', 'end', 'update_end_time']),
  handler: handleMaintenanceModeTool,
};
