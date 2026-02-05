import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const tagsToolSchema = {
  name: 'tags',
  description: 'Query ThreatLocker tags for network and policy management',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'dropdown'],
        description: 'Action to perform',
      },
      tagId: {
        type: 'string',
        description: 'Tag ID (required for get action)',
      },
      includeBuiltIns: {
        type: 'boolean',
        description: 'Include ThreatLocker built-in tags (default: false)',
      },
      tagType: {
        type: 'number',
        description: 'Tag type filter (default: 1)',
      },
      includeNetworkTagInMaster: {
        type: 'boolean',
        description: 'Include network tags in master (default: true)',
      },
    },
    required: ['action'],
  },
};

interface TagsInput {
  action?: 'get' | 'dropdown';
  tagId?: string;
  includeBuiltIns?: boolean;
  tagType?: number;
  includeNetworkTagInMaster?: boolean;
}

export async function handleTagsTool(
  client: ThreatLockerClient,
  input: TagsInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    tagId,
    includeBuiltIns = false,
    tagType = 1,
    includeNetworkTagInMaster = true,
  } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'get':
      if (!tagId) {
        return errorResponse('BAD_REQUEST', 'tagId is required for get action');
      }
      return client.get('Tag/TagGetById', { tagId });

    case 'dropdown':
      return client.get('Tag/TagGetDowndownOptionsByOrganizationId', {
        includeBuiltIns: String(includeBuiltIns),
        tagType: String(tagType),
        includeNetworkTagInMaster: String(includeNetworkTagInMaster),
      });

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
