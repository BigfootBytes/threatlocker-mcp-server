# Output Schemas & Code Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-tool output schemas so clients get typed structured content, remove dead code, and standardize error messages across all 16 tools.

**Architecture:** Each tool file gains an `outputZodSchema` that describes the `ApiResponse<T>` envelope with a typed `data` field using `.passthrough()` entity shapes. Shared sub-schemas (pagination, error) are extracted to `types/responses.ts`. Dead `if (!action)` guards are removed since Zod validates action enums before handlers run.

**Tech Stack:** TypeScript, Zod, MCP SDK, Vitest

---

### Task 1: Extract shared output sub-schemas

**Files:**
- Modify: `src/types/responses.ts`

**Step 1: Add `paginationOutputSchema` and `errorOutputSchema` exports**

After the existing `apiResponseOutputSchema` (after line 54), add:

```typescript
/** Reusable sub-schema for pagination in per-tool output schemas. */
export const paginationOutputSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  totalItems: z.number(),
  totalPages: z.number(),
  has_more: z.boolean().describe('Whether more pages are available'),
  nextPage: z.number().nullable().describe('Next page number, or null if on the last page'),
});

/** Reusable sub-schema for error details in per-tool output schemas. */
export const errorOutputSchema = z.object({
  code: z.string(),
  message: z.string(),
  statusCode: z.number().optional(),
});
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/responses.ts
git commit -m "refactor: extract shared output sub-schemas for per-tool reuse"
```

---

### Task 2: Write failing registry test for per-tool outputZodSchema

**Files:**
- Modify: `src/tools/registry.test.ts`

**Step 1: Add test that checks each tool has explicit `outputZodSchema`**

After the existing `allToolsWithSchema entries have outputSchema` test (line 58), add:

```typescript
  it.each(allTools.map(t => [t.name, t]))(
    '%s has explicit outputZodSchema',
    (_name, tool) => {
      const t = tool as ToolDefinition;
      expect(t.outputZodSchema, `${t.name} should define outputZodSchema`).toBeDefined();
      // Must have the standard envelope fields
      expect(t.outputZodSchema!.success).toBeDefined();
      expect(t.outputZodSchema!.data).toBeDefined();
      expect(t.outputZodSchema!.pagination).toBeDefined();
      expect(t.outputZodSchema!.error).toBeDefined();
    }
  );
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/registry.test.ts`
Expected: 16 failures — no tool currently exports `outputZodSchema`

**Step 3: Commit**

```bash
git add src/tools/registry.test.ts
git commit -m "test: add failing test for per-tool outputZodSchema"
```

---

### Task 3: Add outputZodSchema to computers, computer_groups, applications

For each file: add `outputZodSchema` to the `ToolDefinition` export and remove the dead `if (!action)` guard.

**Files:**
- Modify: `src/tools/computers.ts`
- Modify: `src/tools/computer-groups.ts`
- Modify: `src/tools/applications.ts`

**Step 1: Modify `src/tools/computers.ts`**

Add import at top (after existing imports):
```typescript
import { paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
```

Remove lines 27-29 (dead code):
```typescript
  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }
```

Add output schema before the `computersTool` definition:
```typescript
const computerObject = z.object({
  computerId: z.string(),
  computerName: z.string(),
  computerGroupName: z.string(),
  lastCheckin: z.string(),
  action: z.string().describe('Secure, Installation, Learning, or MonitorOnly'),
  threatLockerVersion: z.string(),
}).passthrough();

export const computersOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(computerObject).describe('list: array of computers'),
    computerObject.describe('get: single computer detail'),
    z.array(z.object({
      computerId: z.string(),
      checkinType: z.string(),
      dateTime: z.string(),
    }).passthrough()).describe('checkins: array of check-in records'),
    z.object({}).passthrough().describe('get_install_info: installation details'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

Add `outputZodSchema: computersOutputZodSchema,` to the `computersTool` definition.

**Step 2: Modify `src/tools/computer-groups.ts`**

Add import:
```typescript
import { paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
```

Remove `if (!action)` guard (lines 31-33).

Add output schema:
```typescript
const computerGroupObject = z.object({
  computerGroupId: z.string(),
  name: z.string(),
  osType: z.number(),
  computerCount: z.number(),
  organizationId: z.string(),
}).passthrough();

export const computerGroupsOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.object({}).passthrough().describe('list: nested object with groups, computers, policies'),
    z.array(computerGroupObject).describe('dropdown/dropdown_with_org/get_for_permit: array of groups'),
    computerGroupObject.describe('get_by_install_key: single group'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

Add `outputZodSchema: computerGroupsOutputZodSchema,` to the `computerGroupsTool` definition.

**Step 3: Modify `src/tools/applications.ts`**

Add import:
```typescript
import { paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
```

Remove `if (!action)` guard (lines 34-36).

Add output schema:
```typescript
const applicationObject = z.object({
  applicationId: z.string(),
  name: z.string(),
  osType: z.number(),
  computerCount: z.number(),
  policyCount: z.number(),
}).passthrough();

const researchObject = z.object({
  productName: z.string(),
  productDescription: z.string(),
  concernRating: z.number(),
  reviewRating: z.number(),
  categories: z.array(z.string()),
  countriesWhereCodeCompiled: z.array(z.string()),
}).passthrough();

export const applicationsOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(applicationObject).describe('search/match/get_for_maintenance: array of applications'),
    applicationObject.describe('get/get_for_network_policy: single application'),
    researchObject.describe('research: ThreatLocker security analysis'),
    z.array(z.object({
      fullPath: z.string(),
      hash: z.string(),
      cert: z.string(),
    }).passthrough()).describe('files: array of file rules'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

Add `outputZodSchema: applicationsOutputZodSchema,` to the `applicationsTool` definition.

**Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Run tests**

Run: `npx vitest run`
Expected: Existing tests pass; registry test still fails (13 tools remaining)

**Step 6: Commit**

```bash
git add src/tools/computers.ts src/tools/computer-groups.ts src/tools/applications.ts
git commit -m "feat: add outputZodSchema to computers, computer_groups, applications"
```

---

### Task 4: Add outputZodSchema to policies, action_log, approval_requests

**Files:**
- Modify: `src/tools/policies.ts`
- Modify: `src/tools/action-log.ts`
- Modify: `src/tools/approval-requests.ts`

**Step 1: Modify `src/tools/policies.ts`**

Add import:
```typescript
import { paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
```

Remove `if (!action)` guard (lines 22-24).

Add output schema:
```typescript
const policyObject = z.object({
  policyId: z.string(),
  name: z.string(),
  policyActionId: z.number().describe('1=Permit, 2=Deny, 6=Permit+Ringfence'),
  applicationId: z.string(),
  computerGroupId: z.string(),
  isEnabled: z.boolean(),
}).passthrough();

export const policiesOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    policyObject.describe('get: single policy'),
    z.array(policyObject).describe('list_by_application: array of policies'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

Add `outputZodSchema: policiesOutputZodSchema,` to the `policiesTool` definition.

**Step 2: Modify `src/tools/action-log.ts`**

Add import:
```typescript
import { paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
```

Remove `if (!action)` guard (lines 29-31).

Add output schema:
```typescript
const actionLogObject = z.object({
  actionLogId: z.string(),
  fullPath: z.string(),
  processPath: z.string(),
  hostname: z.string(),
  username: z.string(),
  actionType: z.string(),
  policyName: z.string(),
  applicationName: z.string(),
}).passthrough();

export const actionLogOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(actionLogObject).describe('search/file_history: array of audit log entries'),
    actionLogObject.describe('get: single audit log entry'),
    z.object({}).passthrough().describe('get_file_download/get_policy_conditions/get_testing_details: detail object'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

Add `outputZodSchema: actionLogOutputZodSchema,` to the `actionLogTool` definition.

**Step 3: Modify `src/tools/approval-requests.ts`**

Add import:
```typescript
import { paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
```

Remove `if (!action)` guard (lines 23-25).

Add output schema:
```typescript
const approvalRequestObject = z.object({
  approvalRequestId: z.string(),
  username: z.string(),
  fullPath: z.string(),
  actionType: z.string(),
  statusId: z.number().describe('1=Pending, 4=Approved, 6=Not Learned, 10=Ignored, 12=Added, 13=Escalated, 16=Self-Approved'),
  computerName: z.string(),
  requestDateTime: z.string(),
}).passthrough();

export const approvalRequestsOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(approvalRequestObject).describe('list: array of approval requests'),
    approvalRequestObject.describe('get/get_file_download_details/get_permit_application/get_storage_approval: single request'),
    z.object({ count: z.number() }).passthrough().describe('count: pending request count'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

Add `outputZodSchema: approvalRequestsOutputZodSchema,` to the `approvalRequestsTool` definition.

**Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Run tests**

Run: `npx vitest run`
Expected: Existing tests pass; registry test still fails (10 tools remaining)

**Step 6: Commit**

```bash
git add src/tools/policies.ts src/tools/action-log.ts src/tools/approval-requests.ts
git commit -m "feat: add outputZodSchema to policies, action_log, approval_requests"
```

---

### Task 5: Add outputZodSchema to organizations, reports, maintenance_mode

**Files:**
- Modify: `src/tools/organizations.ts`
- Modify: `src/tools/reports.ts`
- Modify: `src/tools/maintenance-mode.ts`

**Step 1: Modify `src/tools/organizations.ts`**

Add import:
```typescript
import { paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
```

Remove `if (!action)` guard (lines 20-22).

Add output schema:
```typescript
const organizationObject = z.object({
  organizationId: z.string(),
  name: z.string(),
  displayName: z.string(),
  dateAdded: z.string(),
  computerCount: z.number(),
}).passthrough();

export const organizationsOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(organizationObject).describe('list_children/get_for_move_computers: array of organizations'),
    z.object({}).passthrough().describe('get_auth_key: authentication key details'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

Add `outputZodSchema: organizationsOutputZodSchema,` to the `organizationsTool` definition.

**Step 2: Modify `src/tools/reports.ts`**

Add import:
```typescript
import { paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
```

Remove `if (!action)` guard (lines 14-16).

Add output schema:
```typescript
const reportObject = z.object({
  reportId: z.string(),
  name: z.string(),
  description: z.string(),
}).passthrough();

export const reportsOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(reportObject).describe('list: array of available reports'),
    z.object({}).passthrough().describe('get_data: dynamic report data (columns vary by report type)'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

Add `outputZodSchema: reportsOutputZodSchema,` to the `reportsTool` definition.

**Step 3: Modify `src/tools/maintenance-mode.ts`**

Add import:
```typescript
import { paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
```

Remove `if (!action)` guard (lines 18-20).

Add output schema:
```typescript
const maintenanceModeObject = z.object({
  maintenanceModeId: z.string(),
  maintenanceTypeId: z.number().describe('1=MonitorOnly, 2=InstallationMode, 3=Learning, 6=TamperProtection'),
  startDateTime: z.string(),
  endDateTime: z.string(),
  userName: z.string(),
}).passthrough();

export const maintenanceModeOutputZodSchema = {
  success: z.boolean(),
  data: z.array(maintenanceModeObject).optional().describe('get_history: array of maintenance mode records'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

Add `outputZodSchema: maintenanceModeOutputZodSchema,` to the `maintenanceModeTool` definition.

**Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Run tests**

Run: `npx vitest run`
Expected: Existing tests pass; registry test still fails (7 tools remaining)

**Step 6: Commit**

```bash
git add src/tools/organizations.ts src/tools/reports.ts src/tools/maintenance-mode.ts
git commit -m "feat: add outputZodSchema to organizations, reports, maintenance_mode"
```

---

### Task 6: Add outputZodSchema to scheduled_actions, system_audit, tags

**Files:**
- Modify: `src/tools/scheduled-actions.ts`
- Modify: `src/tools/system-audit.ts`
- Modify: `src/tools/tags.ts`

**Step 1: Modify `src/tools/scheduled-actions.ts`**

Add import:
```typescript
import { paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
```

Remove `if (!action)` guard (lines 23-25).

Add output schema:
```typescript
const scheduledActionObject = z.object({
  scheduledAgentActionId: z.string(),
  scheduledType: z.number(),
  scheduledDateTime: z.string(),
  computerName: z.string(),
  computerGroupName: z.string(),
  status: z.string(),
}).passthrough();

export const scheduledActionsOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(scheduledActionObject).describe('list/search: array of scheduled actions'),
    scheduledActionObject.describe('get: single scheduled action'),
    z.array(z.object({}).passthrough()).describe('get_applies_to: array of scheduling targets'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

Add `outputZodSchema: scheduledActionsOutputZodSchema,` to the `scheduledActionsTool` definition.

**Step 2: Modify `src/tools/system-audit.ts`**

Add import:
```typescript
import { paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
```

Remove `if (!action)` guard (lines 28-30).

Add output schema:
```typescript
const systemAuditObject = z.object({
  systemAuditId: z.string(),
  username: z.string(),
  action: z.string().describe('Create, Delete, Logon, Modify, Read'),
  effectiveAction: z.string().describe('Denied or Permitted'),
  details: z.string(),
  ipAddress: z.string(),
  dateTime: z.string(),
}).passthrough();

export const systemAuditOutputZodSchema = {
  success: z.boolean(),
  data: z.array(systemAuditObject).optional().describe('search/health_center: array of audit entries'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

Add `outputZodSchema: systemAuditOutputZodSchema,` to the `systemAuditTool` definition.

**Step 3: Modify `src/tools/tags.ts`**

Add import:
```typescript
import { paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
```

Remove `if (!action)` guard — **no guard exists in tags.ts** (handler goes straight to switch). Skip this step.

Add output schema:
```typescript
const tagObject = z.object({
  tagId: z.string(),
  name: z.string(),
  tagType: z.number(),
}).passthrough();

export const tagsOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    tagObject.describe('get: single tag with values'),
    z.array(tagObject).describe('dropdown: array of available tags'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

Wait — tags.ts line 22 DOES have the dead `if (!action)` guard (lines 12-14... let me re-check). Actually, looking at tags.ts again: the handler destructures action at line 11, then there's no `if (!action)` check — it goes directly to `switch (action)`. **tags.ts does not have the dead guard — skip removal.**

Add `outputZodSchema: tagsOutputZodSchema,` to the `tagsTool` definition.

**Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Run tests**

Run: `npx vitest run`
Expected: Existing tests pass; registry test still fails (4 tools remaining)

**Step 6: Commit**

```bash
git add src/tools/scheduled-actions.ts src/tools/system-audit.ts src/tools/tags.ts
git commit -m "feat: add outputZodSchema to scheduled_actions, system_audit, tags"
```

---

### Task 7: Add outputZodSchema to storage_policies, network_access_policies, threatlocker_versions, online_devices

**Files:**
- Modify: `src/tools/storage-policies.ts`
- Modify: `src/tools/network-access-policies.ts`
- Modify: `src/tools/threatlocker-versions.ts`
- Modify: `src/tools/online-devices.ts`

**Step 1: Modify `src/tools/storage-policies.ts`**

Add import:
```typescript
import { paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
```

Remove `if (!action)` guard (lines 14-16).

Add output schema:
```typescript
const storagePolicyObject = z.object({
  storagePolicyId: z.string(),
  name: z.string(),
  policyType: z.number(),
  osType: z.number(),
  computerGroupName: z.string(),
  isEnabled: z.boolean(),
}).passthrough();

export const storagePoliciesOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    storagePolicyObject.describe('get: single storage policy'),
    z.array(storagePolicyObject).describe('list: array of storage policies'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

Add `outputZodSchema: storagePoliciesOutputZodSchema,` to the `storagePoliciesTool` definition.

**Step 2: Modify `src/tools/network-access-policies.ts`**

Add import:
```typescript
import { paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
```

Remove `if (!action)` guard (lines 13-15).

Add output schema:
```typescript
const networkAccessPolicyObject = z.object({
  networkAccessPolicyId: z.string(),
  name: z.string(),
  computerGroupName: z.string(),
  isEnabled: z.boolean(),
  applicationName: z.string(),
}).passthrough();

export const networkAccessPoliciesOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    networkAccessPolicyObject.describe('get: single network access policy'),
    z.array(networkAccessPolicyObject).describe('list: array of network access policies'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

Add `outputZodSchema: networkAccessPoliciesOutputZodSchema,` to the `networkAccessPoliciesTool` definition.

**Step 3: Modify `src/tools/threatlocker-versions.ts`**

Add import:
```typescript
import { paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
```

Remove `if (!action)` guard (lines 13-15).

Add output schema:
```typescript
export const threatlockerVersionsOutputZodSchema = {
  success: z.boolean(),
  data: z.array(z.object({
    label: z.string().describe('Version string (e.g., "9.3.3")'),
    value: z.string().describe('ThreatLockerVersionId'),
    isEnabled: z.boolean().describe('Whether this version is installable'),
    dateTime: z.string().describe('When version was added to portal'),
    isDefault: z.boolean().describe('Default version for new computer groups'),
    OSTypes: z.number().describe('Operating system type identifier'),
  }).passthrough()).optional().describe('list: array of agent versions'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

Add `outputZodSchema: threatlockerVersionsOutputZodSchema,` to the `threatlockerVersionsTool` definition.

**Step 4: Modify `src/tools/online-devices.ts`**

Add import:
```typescript
import { paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
```

Remove `if (!action)` guard (lines 15-17).

Add output schema:
```typescript
export const onlineDevicesOutputZodSchema = {
  success: z.boolean(),
  data: z.array(z.object({
    computerName: z.string(),
    computerGroupName: z.string(),
    lastCheckin: z.string(),
    ipAddress: z.string(),
  }).passthrough()).optional().describe('list: array of online device objects'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};
```

Add `outputZodSchema: onlineDevicesOutputZodSchema,` to the `onlineDevicesTool` definition.

**Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Run ALL tests — registry test should now pass**

Run: `npx vitest run`
Expected: ALL tests pass including the new registry test (all 16 tools have `outputZodSchema`)

**Step 7: Commit**

```bash
git add src/tools/storage-policies.ts src/tools/network-access-policies.ts src/tools/threatlocker-versions.ts src/tools/online-devices.ts
git commit -m "feat: add outputZodSchema to storage/network policies, versions, online_devices

All 16 tools now define explicit outputZodSchema. Registry test passes."
```

---

### Task 8: Final verification, build, and DEVLOG

**Files:**
- Modify: `DEVLOG.md`

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (772+ existing + new registry tests)

**Step 2: Build to verify**

Run: `npm run build`
Expected: Clean build, no errors

**Step 3: Update DEVLOG.md**

Add at the top:

```markdown
## 2026-02-13 — Per-Tool Output Schemas & Code Polish

- Added per-tool `outputZodSchema` to all 16 tools — clients now receive typed structured content instead of `z.any()` for the data field
- Each output schema describes the `ApiResponse<T>` envelope with entity-specific `.passthrough()` shapes for the `data` field
- Extracted shared `paginationOutputSchema` and `errorOutputSchema` to `types/responses.ts` for reuse
- Removed dead `if (!action)` guards from all handlers (Zod enum validation runs before handlers)
- No behavioral changes — all existing 772+ tests continue to pass
```

**Step 4: Commit**

```bash
git add DEVLOG.md
git commit -m "docs: update DEVLOG with output schemas and polish changes"
```
