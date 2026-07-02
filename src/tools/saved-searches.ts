import { z } from 'zod';
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse, validateGuid, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof savedSearchesZodSchema>>;

export async function handleSavedSearchesTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const { action } = input as ToolInput;

  switch (action) {
    case 'list': {
      const saveSearchPageId = input.saveSearchPageId as number | undefined;
      if (saveSearchPageId === undefined) {
        return errorResponse('BAD_REQUEST', 'saveSearchPageId is required for list action (which page/feature the searches belong to)');
      }
      return client.post('SaveSearch/SaveSearchGetByPage', { saveSearchPageId });
    }

    case 'insert': {
      const saveSearchId = input.saveSearchId as string | undefined;
      const saveSearchPageId = input.saveSearchPageId as number | undefined;
      const organizationId = input.organizationId as string | undefined;
      const searchName = input.searchName as string | undefined;
      const saveParameters = input.saveParameters as string | undefined;
      if (!saveSearchId) return errorResponse('BAD_REQUEST', 'saveSearchId (a new GUID) is required for insert action');
      const idError = validateGuid(saveSearchId, 'saveSearchId');
      if (idError) return idError;
      if (saveSearchPageId === undefined) return errorResponse('BAD_REQUEST', 'saveSearchPageId is required for insert action');
      if (!organizationId) return errorResponse('BAD_REQUEST', 'organizationId is required for insert action');
      const orgError = validateGuid(organizationId, 'organizationId');
      if (orgError) return orgError;
      if (!searchName) return errorResponse('BAD_REQUEST', 'searchName is required for insert action');
      if (!saveParameters) return errorResponse('BAD_REQUEST', 'saveParameters is required for insert action (get it from action_log build_search_string)');
      return client.post('SaveSearch/SaveSearchInsert', {
        saveSearchId,
        saveSearchPageId,
        searchName,
        saveParameters,
        organizationId,
        searchData: input.searchData,
        username: input.username,
        searchCount: input.searchCount,
        datetime: input.datetime,
      });
    }

    case 'delete': {
      const saveSearchId = input.saveSearchId as string | undefined;
      if (!saveSearchId) return errorResponse('BAD_REQUEST', 'saveSearchId is required for delete action');
      const idError = validateGuid(saveSearchId, 'saveSearchId');
      if (idError) return idError;
      return client.delete('SaveSearch/SaveSearchDeleteById', { saveSearchId });
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const savedSearchesZodSchema = {
  action: z.enum(['list', 'insert', 'delete']).describe('list=saved searches for a page, insert=save a new search, delete=delete a saved search'),
  saveSearchPageId: z.number().optional().describe('The page/feature the saved searches belong to (required for list and insert; e.g. the Unified Audit page id).'),
  saveSearchId: z.string().max(100).optional().describe('Saved-search GUID. For insert, supply a NEW GUID; for delete, the existing one.'),
  organizationId: z.string().max(100).optional().describe('Organization GUID (required for insert).'),
  searchName: z.string().max(200).optional().describe('Display name of the saved search (required for insert).'),
  saveParameters: z.string().optional().describe('Opaque serialized search string from action_log build_search_string (required for insert). Round-trip verbatim.'),
  searchData: z.string().optional().describe('Optional human-readable search summary.'),
  username: z.string().max(320).optional().describe('Optional owner username.'),
  searchCount: z.number().optional().describe('Optional usage counter.'),
  datetime: z.string().max(100).optional().describe('Optional created timestamp (UTC).'),
};

const savedSearchObject = z.object({
  saveSearchId: z.string().nullable(),
  searchName: z.string().nullable(),
  saveSearchPageId: z.number().nullable().optional(),
  organizationId: z.string().nullable().optional(),
}).passthrough();

export const savedSearchesOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(savedSearchObject).describe('list: array of saved searches'),
    z.any().describe('insert/delete: operation result'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const savedSearchesTool: ToolDefinition = {
  name: 'saved_searches',
  title: 'ThreatLocker Saved Searches',
  description: `Manage saved Unified Audit / investigation searches.

A saved search stores an opaque serialized parameter string (saveParameters) alongside a name and page id. Build the parameter string with the action_log tool's build_search_string action, then save it here.

Common workflows:
- List saved searches for a page: action=list, saveSearchPageId=<page id>
- Save a search: action_log build_search_string → action=insert, saveSearchId=<new GUID>, saveSearchPageId=<id>, organizationId="...", searchName="...", saveParameters="<blob>"
- Delete a saved search: action=delete, saveSearchId="..."

Pitfalls:
- saveParameters is opaque — produce it via action_log build_search_string and round-trip it verbatim; don't hand-write it.
- insert requires you to supply a fresh saveSearchId GUID.
- Writes are payload-verified, NOT live-tested.

Permissions: View Unified Audit.

Related tools: action_log (build_search_string produces saveParameters)`,
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  zodSchema: savedSearchesZodSchema,
  outputZodSchema: savedSearchesOutputZodSchema,
  writeActions: new Set(['insert', 'delete']),
  handler: handleSavedSearchesTool,
};
