import { z } from 'zod';
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

export const threatlockerVersionsToolSchema = {
  name: 'threatlocker_versions',
  description: `Query available ThreatLocker agent versions.

Returns all agent versions available in the portal, including which are enabled for installation, which is the default for new groups, and when each was released.

Common workflows:
- List all available versions: action=list
- Find the latest version: action=list, look for highest version number with isEnabled=true
- Check if a specific version is still available: action=list, search results for version string
- Identify the default version for new computer groups: action=list, look for isDefault=true
- Plan upgrade rollouts: action=list, compare to installed versions from computers tool

Response fields: label (version string), value (version ID), isEnabled, dateTime (release date), isDefault, OSTypes

Related tools: computers (see installed versions per machine), scheduled_actions (schedule version updates), computer_groups (group-level version settings)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list'],
        description: 'list=get all available ThreatLocker agent versions',
      },
    },
    required: ['action'],
  },
};

interface ThreatLockerVersionsInput {
  action?: 'list';
}

export async function handleThreatLockerVersionsTool(
  client: ThreatLockerClient,
  input: ThreatLockerVersionsInput
): Promise<ApiResponse<unknown>> {
  const { action } = input;

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
  action: z.enum(['list']).describe('Action to perform'),
};

export const threatlockerVersionsTool: ToolDefinition = {
  name: threatlockerVersionsToolSchema.name,
  description: threatlockerVersionsToolSchema.description,
  inputSchema: threatlockerVersionsToolSchema.inputSchema,
  zodSchema: threatlockerVersionsZodSchema,
  handler: handleThreatLockerVersionsTool as ToolDefinition['handler'],
};
