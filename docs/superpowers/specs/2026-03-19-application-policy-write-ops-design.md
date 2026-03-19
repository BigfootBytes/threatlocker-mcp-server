# Application & Policy Write Operations + Read-Only Guard

## Summary

Add write operations (create, update, delete) to the `applications` and `policies` MCP tools, add a `deploy` action for pushing policy changes, add a `put` method to the HTTP client, and introduce a `THREATLOCKER_READ_ONLY` env var that blocks all write actions server-wide.

## Motivation

The MCP server is currently read-only. Users need to manage the full lifecycle of applications and policies: create custom applications with file rules, update them, delete them, create/update/delete/copy policies, and deploy changes. A read-only guard ensures safe deployment in environments where write access should be disabled.

## Scope

### In Scope
- Application CRUD: `create`, `update`, `delete`, `delete_confirm` actions
- Policy CRUD: `create`, `update`, `delete`, `copy`, `deploy` actions
- `ThreatLockerClient.put()` method
- `THREATLOCKER_READ_ONLY` env var enforcement
- Tests for all new functionality

### Out of Scope
- Approval request actions (step 6 from original plan)
- Network/storage policy write ops
- Computer management write ops

## Design

### 1. Read-Only Guard

**Env var:** `THREATLOCKER_READ_ONLY=true` (any truthy value: `true`, `1`, `yes`)

**Implementation:** Add a `writeActions` field to `ToolDefinition` — a `Set<string>` of action names that are write operations. In `server.ts`, the tool registration wrapper checks: if `THREATLOCKER_READ_ONLY` is set and the incoming `action` is in the tool's `writeActions`, return an error immediately without calling the handler.

```typescript
// registry.ts — new optional field
export interface ToolDefinition {
  // ...existing fields...
  writeActions?: Set<string>;  // action names that mutate state
}
```

```typescript
// server.ts — in the registration loop, before calling handler
if (process.env.THREATLOCKER_READ_ONLY?.match(/^(true|1|yes)$/i) && tool.writeActions?.has(action)) {
  return errorResponse('FORBIDDEN', 'Server is in read-only mode (THREATLOCKER_READ_ONLY is set). Write operations are disabled.');
}
```

**Why centralized:** Keeps handlers clean; no per-action boilerplate. Adding a new write action to any tool just means adding it to the set.

### 2. Client: Add `put` Method

Add `put<T>(endpoint, body)` to `ThreatLockerClient`. Same implementation as `post` (JSON body, retry logic, error handling) but with `method: 'PUT'`. No pagination extraction needed for PUT responses since they return single objects.

```typescript
async put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>>
```

### 3. Applications Tool — New Actions

#### `create` — `POST Application/ApplicationInsert`

**Required inputs:**
- `name` (string, max 200) — unique per OS type
- `osType` (0|1|2|3|5)

**Optional inputs:**
- `description` (string, max 2000)
- `fileRules` (array, max 50) — each with: `fullPath`, `processPath`, `installedBy`, `cert`, `hash`, `notes` (all optional strings); `updateStatus` is always set to `1` by the handler

**Request body mapping:**
```json
{
  "name": "...",
  "osType": 1,
  "description": "...",
  "applicationFileUpdates": [
    { "fullPath": "...", "processPath": "", "installedBy": "", "cert": "", "hash": "", "notes": "", "updateStatus": 1 }
  ]
}
```

#### `update` — `PUT Application/ApplicationUpdateById`

**Required inputs:**
- `applicationId` (GUID)
- `name` (string)
- `osType` (0|1|2|3|5) — must match existing, cannot change

**Optional inputs:**
- `description` (string, max 2000)

**Request body:** `{ applicationId, name, description, osType }`

#### `delete` — `POST Application/ApplicationUpdateForDelete`

For applications with no attached policies.

**Required inputs:**
- `applications` (array, 1-50) — each: `{ applicationId, name, organizationId, osType }`

#### `delete_confirm` — `POST Application/ApplicationConfirmUpdateForDelete`

For applications that have attached policies (force delete).

**Required inputs:** Same as `delete`.

### 4. Policies Tool — New Actions

#### `create` — `POST Policy/PolicyInsert`

**Required inputs:**
- `name` (string, max 200)
- `applicationIds` (array of GUIDs, 1-50) — mapped to `applicationIdList`
- `computerGroupId` (GUID)
- `osType` (1|2|3|5) — no "All" for policy creation
- `policyActionId` (1|2|6) — Permit, Deny, Permit+Ringfence

**Optional inputs:**
- `isEnabled` (boolean, default true)
- `logAction` (boolean, default true)
- `elevationStatus` (0|1|2|3, default 0)
- `policyScheduleStatus` (0|1|2, default 0)
- `endDate` (UTC datetime string) — for expiration schedule
- `allowRequest` (boolean, default false)
- `killRunningProcesses` (boolean, default false)

**Request body mapping:** Direct field mapping, `applicationIds` -> `applicationIdList`.

#### `update` — `PUT Policy/PolicyUpdateById`

**Required inputs:**
- `policyId` (GUID)
- `name` (string)
- `applicationIds` (array of GUIDs)
- `computerGroupId` (GUID)
- `osType` (1|2|3|5) — cannot change
- `policyActionId` (1|2|6)

**Optional inputs:** Same optional fields as `create`.

**Important:** All fields must be provided. Omitted optional fields reset to defaults. The handler's description will warn about this.

#### `delete` — `PUT Policy/PolicyUpdateForDeleteByIds`

**Required inputs:**
- `policyIds` (array of GUIDs, 1-50)

**Request body:** `{ policyIds: [{ policyId: "..." }, ...] }`

#### `copy` — `POST Policy/PolicyInsertForCopyPolicies`

**Required inputs:**
- `osType` (1|2|3|5)
- `policyIds` (array of GUIDs, 1-50)
- `sourceAppliesToId` (GUID) — source computer group
- `sourceOrganizationId` (GUID)
- `targetAppliesToIds` (array of GUIDs, 1-50) — destination computer groups

**Request body mapping:**
```json
{
  "osType": 1,
  "policies": [{ "policyId": "..." }],
  "sourceAppliesToId": "...",
  "sourceOrganizationId": "...",
  "targetAppliesToIds": ["..."]
}
```

#### `deploy` — `POST DeployPolicyQueue/DeployPolicyQueueInsert`

**Required inputs:**
- `organizationId` (GUID)

**Request body:** `{ organizationId: "..." }`

**Note:** The exact endpoint path is not fully documented in the KB. The CLAUDE.md says "deploy via DeployPolicyQueue endpoints." We'll use `DeployPolicyQueue/DeployPolicyQueueInsert` based on ThreatLocker's naming conventions. If the exact path differs, it's a one-line fix.

### 5. Tool Annotations Update

Both `applications` and `policies` tools change from read-only to mixed:

```typescript
annotations: {
  readOnlyHint: false,      // was true — tool now has write actions
  destructiveHint: false,    // conservative: not all actions are destructive
  idempotentHint: false,     // write actions are not idempotent
  openWorldHint: true,       // unchanged
}
```

### 6. Tool Descriptions Update

Both tool descriptions need updating to document the new actions and workflows. The `policies` description should mention the deploy step after create/update/copy/delete.

### 7. Output Schemas Update

New Zod output types for write responses. The ThreatLocker API typically returns the created/updated object on success, or a simple success acknowledgment for deletes. We'll use `.passthrough()` on response objects to handle varying API response shapes.

## File Changes

| File | Change |
|------|--------|
| `src/client.ts` | Add `put()` method |
| `src/tools/registry.ts` | Add `writeActions?: Set<string>` to `ToolDefinition` |
| `src/server.ts` | Add read-only guard in registration wrapper |
| `src/tools/applications.ts` | Add `create`, `update`, `delete`, `delete_confirm` actions + schemas |
| `src/tools/policies.ts` | Add `create`, `update`, `delete`, `copy`, `deploy` actions + schemas |
| `src/index.ts` | No changes needed (env var read at runtime in server.ts) |
| Tests | New tests for all write actions + read-only guard |

## Testing Strategy

- Unit tests for each new action's input validation (missing required fields, invalid GUIDs)
- Unit tests for the read-only guard (blocks write actions, allows read actions)
- Unit tests for `client.put()` method
- Integration-style tests with mocked HTTP responses for each endpoint
