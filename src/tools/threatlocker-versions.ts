import { z } from 'zod';
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof threatlockerVersionsZodSchema>>;

export async function handleThreatLockerVersionsTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const { action } = input as ToolInput;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list':
      return client.get('ThreatLockerVersion/ThreatLockerVersionGetForDropdownList', {});

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const threatlockerVersionsZodSchema = {
  action: z.enum(['list']).describe('list=get all available ThreatLocker agent versions'),
};

export const threatlockerVersionsTool: ToolDefinition = {
  name: 'threatlocker_versions',
  title: 'ThreatLocker Versions',
  description: `Query available ThreatLocker agent versions.

Returns all agent versions available in the portal, including which are enabled for installation, which is the default for new groups, and when each was released.

Common workflows:
- List all available versions: action=list
- Find the latest version: action=list, look for highest version number with isEnabled=true
- Check if a specific version is still available: action=list, search results for version string
- Identify the default version for new computer groups: action=list, look for isDefault=true
- Plan upgrade rollouts: action=list, compare to installed versions from computers tool

Permissions: Edit Computers, Edit Computer Groups, View Computers, Install Computers.
No pagination — returns all versions in a single response.
Key response fields: label (version string), value (version ID), isEnabled, dateTime (release date), isDefault, OSTypes.

Related tools: threatlocker_computers (see installed versions per machine), threatlocker_scheduled_actions (schedule version updates), threatlocker_computer_groups (group-level version settings)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: threatlockerVersionsZodSchema,
  handler: handleThreatLockerVersionsTool,
};
