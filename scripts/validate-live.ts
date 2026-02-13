/**
 * Live validation script — calls each tool's simplest read-only action against the real API.
 * Usage: npx tsx scripts/validate-live.ts
 */
import 'dotenv/config';
import { ThreatLockerClient } from '../src/client.js';
import { allTools } from '../src/tools/registry.js';

const client = new ThreatLockerClient({
  apiKey: process.env.THREATLOCKER_API_KEY!,
  baseUrl: process.env.THREATLOCKER_BASE_URL!,
  organizationId: process.env.THREATLOCKER_ORG_ID,
});

// For each tool, define the simplest read-only call (no required IDs)
const testCases: { tool: string; input: Record<string, unknown> }[] = [
  { tool: 'computers', input: { action: 'list', pageSize: 2 } },
  { tool: 'computers', input: { action: 'get_install_info' } },
  { tool: 'computer_groups', input: { action: 'list' } },
  { tool: 'computer_groups', input: { action: 'dropdown' } },
  { tool: 'computer_groups', input: { action: 'dropdown_with_org' } },
  { tool: 'computer_groups', input: { action: 'get_for_permit' } },
  { tool: 'applications', input: { action: 'search', pageSize: 2 } },
  { tool: 'applications', input: { action: 'get_for_maintenance' } },
  { tool: 'applications', input: { action: 'match', osType: 1 } },
  { tool: 'policies', input: { action: 'get', policyId: '00000000-0000-0000-0000-000000000000' } }, // expect 400/404
  { tool: 'action_log', input: { action: 'search', startDate: '2026-02-12T00:00:00Z', endDate: '2026-02-13T23:59:59Z', pageSize: 2 } },
  { tool: 'approval_requests', input: { action: 'list', statusId: 1, pageSize: 2 } },
  { tool: 'approval_requests', input: { action: 'list', pageSize: 2 } }, // tests the new default
  { tool: 'approval_requests', input: { action: 'count' } },
  { tool: 'organizations', input: { action: 'list_children', pageSize: 2 } },
  { tool: 'organizations', input: { action: 'get_auth_key' } },
  { tool: 'organizations', input: { action: 'get_for_move_computers' } },
  { tool: 'reports', input: { action: 'list' } },
  { tool: 'scheduled_actions', input: { action: 'list' } },
  { tool: 'scheduled_actions', input: { action: 'search', pageSize: 2 } },
  { tool: 'scheduled_actions', input: { action: 'get_applies_to' } },
  { tool: 'system_audit', input: { action: 'search', startDate: '2026-02-12T00:00:00Z', endDate: '2026-02-13T23:59:59Z', pageSize: 2 } },
  { tool: 'system_audit', input: { action: 'health_center' } },
  { tool: 'tags', input: { action: 'dropdown' } },
  { tool: 'storage_policies', input: { action: 'list', pageSize: 2 } },
  { tool: 'network_access_policies', input: { action: 'list', pageSize: 2 } },
  { tool: 'versions', input: { action: 'list' } },
  { tool: 'online_devices', input: { action: 'list' } },
];

const toolMap = new Map(allTools.map(t => [t.name, t]));

interface Result {
  tool: string;
  action: string;
  status: 'PASS' | 'FAIL' | 'EXPECTED_FAIL';
  detail: string;
  duration: number;
}

async function runTest(tc: { tool: string; input: Record<string, unknown> }): Promise<Result> {
  const action = tc.input.action as string;
  const label = `${tc.tool}.${action}`;
  const toolDef = toolMap.get(tc.tool);

  if (!toolDef) {
    return { tool: tc.tool, action, status: 'FAIL', detail: 'Tool not found in registry', duration: 0 };
  }

  const start = Date.now();
  try {
    const result = await toolDef.handler(client, tc.input);
    const duration = Date.now() - start;

    if (result.success) {
      const dataPreview = Array.isArray(result.data)
        ? `array[${result.data.length}]`
        : typeof result.data === 'object' && result.data !== null
          ? Object.keys(result.data).slice(0, 5).join(', ')
          : String(result.data);
      return { tool: tc.tool, action, status: 'PASS', detail: dataPreview, duration };
    } else {
      // Some calls with dummy IDs are expected to fail
      const isExpectedFail = tc.input.policyId === '00000000-0000-0000-0000-000000000000';
      return {
        tool: tc.tool,
        action,
        status: isExpectedFail ? 'EXPECTED_FAIL' : 'FAIL',
        detail: `${result.error.code}: ${result.error.message}`,
        duration,
      };
    }
  } catch (err) {
    const duration = Date.now() - start;
    return { tool: tc.tool, action, status: 'FAIL', detail: `EXCEPTION: ${err}`, duration };
  }
}

async function main() {
  console.log(`\nValidating ${testCases.length} tool actions against live API...\n`);
  console.log(`Base URL: ${process.env.THREATLOCKER_BASE_URL}`);
  console.log(`Org ID:   ${process.env.THREATLOCKER_ORG_ID}\n`);
  console.log('─'.repeat(100));

  const results: Result[] = [];

  for (const tc of testCases) {
    const result = await runTest(tc);
    results.push(result);

    const icon = result.status === 'PASS' ? 'OK' : result.status === 'EXPECTED_FAIL' ? 'EF' : '!!';
    const label = `${result.tool}.${result.action}`.padEnd(45);
    const dur = `${result.duration}ms`.padStart(6);
    console.log(`[${icon}] ${label} ${dur}  ${result.detail.substring(0, 50)}`);
  }

  console.log('─'.repeat(100));

  const pass = results.filter(r => r.status === 'PASS').length;
  const expected = results.filter(r => r.status === 'EXPECTED_FAIL').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  console.log(`\nResults: ${pass} passed, ${expected} expected failures, ${fail} FAILED\n`);

  if (fail > 0) {
    console.log('FAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ${r.tool}.${r.action}: ${r.detail}`);
    });
    console.log();
    process.exit(1);
  }
}

main();
