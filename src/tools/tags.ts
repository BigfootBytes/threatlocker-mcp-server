import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse, validateGuid } from '../types/responses.js';

export const tagsToolSchema = {
  name: 'tags',
  description: `Query ThreatLocker tags for network and policy management.

Tags are reusable labels for IP addresses, domains, ports, or other network identifiers. They simplify policy management by letting you reference "CRM Servers" instead of listing individual IPs.

Common workflows:
- List all available tags: action=dropdown
- Include ThreatLocker built-in tags: action=dropdown, includeBuiltIns=true
- Get tag details by ID: action=get, tagId="..."

Tags are used in:
- Network Control policies (allow/deny traffic to tagged destinations)
- Ringfencing (restrict app network access to tagged resources)
- Storage Control (restrict file access to tagged paths)

Parent organization tags appear as "parentOrgName\\tagName" format.

Related tools: policies (use tags in policy rules), applications (ringfence with tags)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'dropdown'],
        description: 'get=single tag details, dropdown=list all available tags for selection',
      },
      tagId: {
        type: 'string',
        description: 'Tag GUID (required for get). Get from dropdown action.',
      },
      includeBuiltIns: {
        type: 'boolean',
        description: 'Include ThreatLocker-provided built-in tags (Microsoft, Google, etc.).',
      },
      tagType: {
        type: 'number',
        description: 'Filter by tag type (default: 1). Type determines what the tag can label.',
      },
      includeNetworkTagInMaster: {
        type: 'boolean',
        description: 'Include network tags when viewing from master/parent organization.',
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
    case 'get': {
      if (!tagId) {
        return errorResponse('BAD_REQUEST', 'tagId is required for get action');
      }
      const guidError = validateGuid(tagId, 'tagId');
      if (guidError) return guidError;
      return client.get('Tag/TagGetById', { tagId });
    }

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
