import { z } from 'zod';
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse, validateGuid } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof tagsZodSchema>>;

export async function handleTagsTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const {
    action,
    tagId,
    includeBuiltIns = false,
    tagType = 1,
    includeNetworkTagInMaster = true,
  } = input as ToolInput;

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

export const tagsZodSchema = {
  action: z.enum(['get', 'dropdown']).describe('Action to perform'),
  tagId: z.string().max(100).optional().describe('Tag ID (required for get)'),
  includeBuiltIns: z.boolean().optional().describe('Include ThreatLocker built-in tags (default: false)'),
  tagType: z.number().optional().describe('Tag type filter (default: 1)'),
  includeNetworkTagInMaster: z.boolean().optional().describe('Include network tags in master (default: true)'),
};

export const tagsTool: ToolDefinition = {
  name: 'threatlocker_tags',
  title: 'ThreatLocker Tags',
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

Permissions: Edit Network Control Policies, Manage Tags, Edit Application Control Policies.
Key response fields: tagId, name, tagType, values (IP/domain/port entries).

Related tools: policies (use tags in policy rules), applications (ringfence with tags)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: tagsZodSchema,
  handler: handleTagsTool,
};
