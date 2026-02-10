import { z } from 'zod';
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

export const threatlockerVersionsToolSchema = {
  name: 'threatlocker_versions',
  description: `Query ThreatLocker agent versions.

Returns the catalog of available ThreatLocker agent versions, including version labels, availability status, release dates, and which OS each version supports.

Common workflows:
- List all available agent versions: action=list

Useful for checking which versions are available for deployment, finding the default version for new installs, and auditing version currency across your fleet.

Related tools: computers (see installed versions), scheduled_actions (schedule version updates), computer_groups (group-level version settings)`,
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
