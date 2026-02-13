import { z } from 'zod';
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof threatlockerVersionsZodSchema>>;

export async function handleThreatLockerVersionsTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const { action } = input as ToolInput;

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

export const threatlockerVersionsOutputZodSchema = {
  success: z.boolean(),
  data: z.array(z.object({
    label: z.string().describe('Version string (e.g., "9.3.3")'),
    value: z.string().describe('ThreatLockerVersionId'),
    isEnabled: z.boolean().describe('Whether this version is installable'),
    dateTime: z.string().describe('When version was added to portal'),
    isDefault: z.boolean().describe('Default version for new computer groups'),
    OSTypes: z.number().describe('Operating system type identifier'),
  }).passthrough()).optional().describe('list: array of agent versions'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const threatlockerVersionsTool: ToolDefinition = {
  name: 'versions',
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

Related tools: computers (see installed versions per machine), scheduled_actions (schedule version updates), computer_groups (group-level version settings)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: threatlockerVersionsZodSchema,
  outputZodSchema: threatlockerVersionsOutputZodSchema,
  handler: handleThreatLockerVersionsTool,
};
