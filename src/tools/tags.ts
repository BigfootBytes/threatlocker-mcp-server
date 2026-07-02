import { z } from 'zod';
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse, validateGuid, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
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

    case 'update': {
      if (!tagId) {
        return errorResponse('BAD_REQUEST', 'tagId is required for update action');
      }
      const guidError = validateGuid(tagId, 'tagId');
      if (guidError) return guidError;
      const organizationId = input.organizationId as string | undefined;
      if (!organizationId) {
        return errorResponse('BAD_REQUEST', 'organizationId is required for update action');
      }
      const orgError = validateGuid(organizationId, 'organizationId');
      if (orgError) return orgError;
      // Full-object replace: any item array omitted is CLEARED server-side. Caller must get first and resend all items to keep.
      return client.post('Tag/TagUpdate', {
        tagId,
        organizationId,
        name: input.name,
        active: input.active ?? true,
        tagType,
        tagItemsText: input.tagItemsText,
        tagItemsIPv4: input.tagItemsIPv4,
        tagItemsIPv6: input.tagItemsIPv6,
        tagItemsReadablePath: input.tagItemsReadablePath,
        tagItemsWritablePath: input.tagItemsWritablePath,
        allTagItems: input.allTagItems,
      });
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

const tagItemInput = z.object({ label: z.string().max(500), value: z.string().max(1000) }).passthrough();

export const tagsZodSchema = {
  action: z.enum(['get', 'dropdown', 'update']).describe('get=single tag details, dropdown=list all available tags for selection, update=replace a tag\'s membership (full-object replace — get first, resend all items)'),
  tagId: z.string().max(100).optional().describe('Tag GUID (required for get, update). Find via dropdown action first.'),
  organizationId: z.string().max(100).optional().describe('Organization GUID that owns the tag (required for update).'),
  name: z.string().max(200).optional().describe('Tag name (update).'),
  active: z.boolean().optional().describe('Whether the tag is active (update; default true).'),
  tagItemsText: z.array(tagItemInput).optional().describe('update: text/domain entries {label,value}. Full replace.'),
  tagItemsIPv4: z.array(tagItemInput).optional().describe('update: IPv4 entries {label,value}. Full replace.'),
  tagItemsIPv6: z.array(tagItemInput).optional().describe('update: IPv6 entries {label,value}. Full replace.'),
  tagItemsReadablePath: z.array(tagItemInput).optional().describe('update: readable-path entries {label,value}. Use \\\\ in path values. Full replace.'),
  tagItemsWritablePath: z.array(tagItemInput).optional().describe('update: writable-path entries {label,value}. Use \\\\ in path values. Full replace.'),
  allTagItems: z.array(z.object({}).passthrough()).optional().describe('update: optional flattened tag-item view (round-trip from get).'),
  includeBuiltIns: z.boolean().optional().describe('Include ThreatLocker built-in tags (default: false)'),
  tagType: z.number().optional().describe('Tag type filter: 1=Network tags (default)'),
  includeNetworkTagInMaster: z.boolean().optional().describe('Include network tags in master (default: true)'),
};

const tagObject = z.object({
  tagId: z.string().nullable(),
  name: z.string().nullable(),
  tagType: z.number(),
  tagItemsText: z.array(z.unknown()).optional().describe('Text/domain entries'),
  tagItemsIPv4: z.array(z.unknown()).optional().describe('IPv4 entries'),
  tagItemsIPv6: z.array(z.unknown()).optional().describe('IPv6 entries'),
  tagItemsReadablePath: z.array(z.unknown()).optional().describe('Readable path entries'),
  tagItemsWritablePath: z.array(z.unknown()).optional().describe('Writable path entries'),
}).passthrough();

const dropdownItem = z.object({
  label: z.string().nullable(),
  value: z.string().nullable(),
}).passthrough();

export const tagsOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    tagObject.describe('get: single tag with values'),
    z.array(dropdownItem).describe('dropdown: array of dropdown items'),
    z.any().describe('update: operation result'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const tagsTool: ToolDefinition = {
  name: 'tags',
  title: 'ThreatLocker Tags',
  description: `Query ThreatLocker tags for network and policy management.

Tags are reusable labels for IP addresses, domains, ports, or other network identifiers. They simplify policy management by letting you reference "CRM Servers" instead of listing individual IPs.

Common workflows:
- List all available tags: action=dropdown
- Include ThreatLocker built-in tags: action=dropdown, includeBuiltIns=true
- Get tag details by ID: action=get, tagId="..."
- Update tag membership: action=update, tagId="...", organizationId="..." (full-object replace — get first, resend ALL item arrays you want to keep; there is no insert/delete endpoint)

Tags are used in:
- Network Control policies (allow/deny traffic to tagged destinations)
- Ringfencing (restrict app network access to tagged resources)
- Storage Control (restrict file access to tagged paths)

Parent organization tags appear as "parentOrgName\\tagName" format.

Pitfalls:
- Use dropdown to get the label+value (tagId) needed when building network/ringfence policy payloads.
- Parent-organization tags use the "ParentOrg\\TagName" format.

Permissions: Edit Network Control Policies, Manage Tags, Edit Application Control Policies.
Key response fields: tagId, name, tagType, values (IP/domain/port entries).

Related tools: policies (use tags in policy rules), applications (ringfence with tags)`,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  zodSchema: tagsZodSchema,
  outputZodSchema: tagsOutputZodSchema,
  writeActions: new Set(['update']),
  handler: handleTagsTool,
};
