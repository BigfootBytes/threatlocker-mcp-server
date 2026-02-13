/**
 * Schema audit — calls each tool action and validates the response against the declared outputZodSchema.
 * Reports mismatches between actual API response fields and schema expectations.
 * Usage: npx tsx scripts/schema-audit.ts
 */
import 'dotenv/config';
import { z } from 'zod';
import { ThreatLockerClient } from '../src/client.js';
import { allTools } from '../src/tools/registry.js';

const client = new ThreatLockerClient({
  apiKey: process.env.THREATLOCKER_API_KEY!,
  baseUrl: process.env.THREATLOCKER_BASE_URL!,
  organizationId: process.env.THREATLOCKER_ORG_ID,
});

const testCases: { tool: string; input: Record<string, unknown>; label: string }[] = [
  { tool: 'computers', input: { action: 'list', pageSize: 2 }, label: 'list' },
  { tool: 'computers', input: { action: 'get_install_info' }, label: 'get_install_info' },
  { tool: 'computer_groups', input: { action: 'list' }, label: 'list' },
  { tool: 'computer_groups', input: { action: 'dropdown' }, label: 'dropdown' },
  { tool: 'computer_groups', input: { action: 'dropdown_with_org' }, label: 'dropdown_with_org' },
  { tool: 'computer_groups', input: { action: 'get_for_permit' }, label: 'get_for_permit' },
  { tool: 'applications', input: { action: 'search', pageSize: 2 }, label: 'search' },
  { tool: 'applications', input: { action: 'match', osType: 1 }, label: 'match' },
  { tool: 'action_log', input: { action: 'search', startDate: '2026-02-12T00:00:00Z', endDate: '2026-02-13T23:59:59Z', pageSize: 2 }, label: 'search' },
  { tool: 'approval_requests', input: { action: 'list', statusId: 1, pageSize: 2 }, label: 'list' },
  { tool: 'approval_requests', input: { action: 'count' }, label: 'count' },
  { tool: 'organizations', input: { action: 'list_children', pageSize: 2 }, label: 'list_children' },
  { tool: 'organizations', input: { action: 'get_for_move_computers' }, label: 'get_for_move_computers' },
  { tool: 'reports', input: { action: 'list' }, label: 'list' },
  { tool: 'scheduled_actions', input: { action: 'list' }, label: 'list' },
  { tool: 'scheduled_actions', input: { action: 'get_applies_to' }, label: 'get_applies_to' },
  { tool: 'system_audit', input: { action: 'search', startDate: '2026-02-12T00:00:00Z', endDate: '2026-02-13T23:59:59Z', pageSize: 2 }, label: 'search' },
  { tool: 'system_audit', input: { action: 'health_center' }, label: 'health_center' },
  { tool: 'tags', input: { action: 'dropdown' }, label: 'dropdown' },
  { tool: 'storage_policies', input: { action: 'list', pageSize: 2 }, label: 'list' },
  { tool: 'network_access_policies', input: { action: 'list', pageSize: 2 }, label: 'list' },
  { tool: 'versions', input: { action: 'list' }, label: 'list' },
  { tool: 'online_devices', input: { action: 'list' }, label: 'list' },
];

const toolMap = new Map(allTools.map(t => [t.name, t]));

async function main() {
  console.log('Schema Audit — comparing live API responses against declared outputZodSchema\n');

  let passCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (const tc of testCases) {
    const toolDef = toolMap.get(tc.tool)!;
    const label = `${tc.tool}.${tc.label}`.padEnd(45);

    try {
      const result = await toolDef.handler(client, tc.input);

      if (!result.success) {
        console.log(`[SKIP] ${label} API error: ${result.error.message}`);
        skipCount++;
        continue;
      }

      // Build the full output schema from the tool's declared outputZodSchema
      const outputSchema = z.object(toolDef.outputZodSchema!);
      const parsed = outputSchema.safeParse(result);

      if (parsed.success) {
        console.log(`[OK]   ${label}`);
        passCount++;
      } else {
        console.log(`[FAIL] ${label}`);
        for (const issue of parsed.error.issues) {
          console.log(`       path: ${issue.path.join('.')} — ${issue.message}`);
        }

        // Show actual data keys for first array item or object
        if (Array.isArray(result.data) && result.data.length > 0) {
          const sample = result.data[0];
          console.log(`       actual keys: ${Object.keys(sample).join(', ')}`);
        } else if (result.data && typeof result.data === 'object') {
          console.log(`       actual keys: ${Object.keys(result.data).join(', ')}`);
        }
        failCount++;
      }
    } catch (err) {
      console.log(`[ERR]  ${label} ${err}`);
      failCount++;
    }
  }

  console.log(`\n${'─'.repeat(80)}`);
  console.log(`Results: ${passCount} passed, ${failCount} FAILED, ${skipCount} skipped\n`);
  if (failCount > 0) process.exit(1);
}

main();
