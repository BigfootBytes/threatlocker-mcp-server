# Output Schemas & Code Polish Design

**Date:** 2026-02-13
**Status:** Approved

## Problem

All 16 tools share a single generic `apiResponseOutputSchema` with `data: z.any()`. Clients receiving `structuredContent` have no type information about the response data. Additionally, every handler contains an unreachable `if (!action)` guard (Zod validates this before the handler runs).

## Goals

1. Per-tool output schemas — type the `data` field with actual entity shapes per tool
2. Remove dead code — eliminate unreachable `if (!action)` guards from all 16 handlers
3. Error message consistency — ensure all "required field" errors include the action name

## Non-Goals

- Switching to `.strict()` Zod validation (keep passthrough)
- Splitting multi-action tools into separate tools
- Changing handler signatures or adding runtime Zod parsing in handlers (casts are safe; validation happens at entry points)
- Rewriting tool descriptions (already good quality)

---

## Design

### Per-Tool Output Schemas

Each tool file gains an `outputZodSchema` export that describes the response envelope with a typed `data` field.

**Pattern for list+get tools** (most tools):
```typescript
const computerObject = z.object({
  computerId: z.string(),
  computerName: z.string(),
  computerGroupName: z.string(),
  lastCheckin: z.string(),
  action: z.string().describe('Mode: Secure, Installation, Learning, MonitorOnly'),
}).passthrough();

export const computersOutputSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(computerObject).describe('list action: array of computers'),
    computerObject.describe('get action: single computer'),
  ]).optional(),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

**Pattern for single-action tools** (online_devices, threatlocker_versions):
```typescript
export const onlineDevicesOutputSchema = {
  success: z.boolean(),
  data: z.array(z.object({
    computerName: z.string(),
    ipAddress: z.string(),
  }).passthrough()).optional().describe('Array of online device objects'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

**Shared sub-schemas** extracted to `types/responses.ts`:
```typescript
export const paginationOutputSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  totalItems: z.number(),
  totalPages: z.number(),
  has_more: z.boolean(),
  nextPage: z.number().nullable(),
});

export const errorOutputSchema = z.object({
  code: z.string(),
  message: z.string(),
  statusCode: z.number().optional(),
});
```

All entity schemas use `.passthrough()` so extra API fields are preserved. Field names are derived from CLAUDE.md API reference and common ThreatLocker entity patterns.

### Dead Code Removal

Remove from all 16 handlers:
```typescript
// REMOVE: unreachable — Zod enum validation runs before handler
if (!action) {
  return errorResponse('BAD_REQUEST', 'action is required');
}
```

Both entry points (MCP SDK `registerTool` and REST endpoint Zod parse) validate `action` before calling the handler.

### Error Message Consistency

Audit all "required field" errors. Ensure pattern:
```
"<fieldName> is required for <actionName> action"
```

Most already follow this pattern. Fix any that don't.

---

## Files Changed

- **All 16 `src/tools/*.ts`**: Add `outputZodSchema`, remove dead `if (!action)` guard, audit error messages
- **`src/types/responses.ts`**: Extract `paginationOutputSchema` and `errorOutputSchema` for reuse
- **Registry tests**: Verify each tool has non-null `outputZodSchema`

## Files Unchanged

- `src/tools/registry.ts` — already handles `outputZodSchema` via `t.outputZodSchema ?? apiResponseOutputSchema`
- `src/server.ts` — already passes output schema and structured content
- `src/transports/http.ts` — already uses `allToolsWithSchema` which includes output schemas

## Testing Strategy

- All existing 772+ tests must pass (no behavioral changes)
- Add registry test: every tool has `outputZodSchema` defined
- No new handler tests needed — only adding schemas and removing dead code

## Risk Assessment

- **Low risk**: No behavioral changes to handlers or API calls
- **Schema accuracy**: Output schemas describe common fields with `.passthrough()` — extra fields preserved, no breakage if API adds fields
- **Dead code removal**: Verified unreachable via Zod validation at all entry points
