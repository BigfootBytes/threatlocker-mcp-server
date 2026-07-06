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
      // The API deserializes searchData server-side and returns an opaque 500 if it is
      // missing or not valid JSON (verified live 2026-07-06). Require it and normalize:
      // accept an object (serialize it) or a JSON string (validate it parses).
      const rawSearchData = input.searchData;
      if (rawSearchData === undefined || rawSearchData === null || rawSearchData === '') {
        return errorResponse('BAD_REQUEST', 'searchData is required for insert action — the search parameters as a JSON object or JSON string. The API deserializes it and fails if it is missing or not valid JSON.');
      }
      let searchData: string;
      if (typeof rawSearchData === 'object') {
        searchData = JSON.stringify(rawSearchData);
      } else {
        searchData = String(rawSearchData);
        try {
          JSON.parse(searchData);
        } catch {
          return errorResponse('BAD_REQUEST', 'searchData must be valid JSON (a serialized search-parameters object).');
        }
      }
      return client.post('SaveSearch/SaveSearchInsert', {
        saveSearchId,
        saveSearchPageId,
        searchName,
        saveParameters,
        organizationId,
        searchData,
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
  saveParameters: z.string().optional().describe('Human-readable search label from action_log build_search_string, e.g. "Any Deny" (required for insert). Round-trip verbatim.'),
  searchData: z.union([z.string(), z.object({}).passthrough()]).optional().describe('REQUIRED for insert: the search parameters that make the search reproducible, as a JSON object or JSON string. The API deserializes this server-side, so it MUST be valid JSON (missing/non-JSON => opaque 500).'),
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

A saved search has two parts: searchData (the reproducible parameters, as JSON) and saveParameters (a human-readable label). saveSearchPageId selects which page the search belongs to (valid values 1-10; e.g. the Unified Audit page).

Common workflows:
- List saved searches for a page: action=list, saveSearchPageId=<page id>
- Save a search: action_log build_search_string (→ saveParameters label) → action=insert, saveSearchId=<new GUID>, saveSearchPageId=<id>, organizationId="...", searchName="...", saveParameters="Any Deny", searchData={the search params object}
- Delete a saved search: action=delete, saveSearchId="..."

Pitfalls:
- searchData is REQUIRED and must be valid JSON (object or JSON string) — the API deserializes it and returns an opaque 500 if it is missing or malformed. (Verified live 2026-07-06.)
- saveParameters is the display label from action_log build_search_string (e.g. "Any Deny").
- saveSearchPageId must be a valid page type (1-10); 0/other values return "Page type wasn't found".
- insert requires you to supply a fresh saveSearchId GUID.

Permissions: View Unified Audit.

Related tools: action_log (build_search_string produces saveParameters)`,
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  zodSchema: savedSearchesZodSchema,
  outputZodSchema: savedSearchesOutputZodSchema,
  writeActions: new Set(['insert', 'delete']),
  handler: handleSavedSearchesTool,
};
