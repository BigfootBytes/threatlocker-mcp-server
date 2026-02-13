import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid } from '../types/responses.js';
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

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

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

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const maintenanceModeZodSchema = {
  action: z.enum(['get_history']).describe('get_history=paginated maintenance mode history for a computer'),
  computerId: z.string().max(100).describe('Computer GUID (required). Find via threatlocker_computers list first.'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
};

export const maintenanceModeTool: ToolDefinition = {
  name: 'threatlocker_maintenance_mode',
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

Permissions: Edit Computers, Manage Application Control Installation Mode, Manage Application Control Learning Mode.
Pagination: get_history is paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: maintenanceModeId, maintenanceTypeId, startDateTime, endDateTime, userName.

Related tools: threatlocker_computers (get computer IDs, see current mode), threatlocker_computer_groups (group-level modes)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: maintenanceModeZodSchema,
  handler: handleMaintenanceModeTool,
};
