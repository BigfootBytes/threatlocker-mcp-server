import { describe, it, expect } from 'vitest';
import { allTools, toolsByName, allToolsWithSchema, ToolDefinition } from './registry.js';

describe('tool registry', () => {
  it('has exactly 16 tools', () => {
    expect(allTools).toHaveLength(16);
  });

  it('toolsByName maps all 16 names', () => {
    expect(toolsByName.size).toBe(16);
  });

  it('allTools and toolsByName are consistent', () => {
    for (const tool of allTools) {
      expect(toolsByName.get(tool.name)).toBe(tool);
    }
  });

  it('has no duplicate names', () => {
    const names = allTools.map(t => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(allTools.map(t => [t.name, t]))(
    '%s has all required ToolDefinition fields',
    (_name, tool) => {
      const t = tool as ToolDefinition;
      expect(typeof t.name).toBe('string');
      expect(t.name.length).toBeGreaterThan(0);
      expect(typeof t.title).toBe('string');
      expect(t.title.length).toBeGreaterThan(0);
      expect(typeof t.description).toBe('string');
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.zodSchema).toBeDefined();
      expect(typeof t.handler).toBe('function');
      // zodSchema must have an 'action' field
      expect(t.zodSchema.action).toBeDefined();
      // annotations must include all four hints
      expect(t.annotations).toBeDefined();
      expect(t.annotations!.readOnlyHint).toBe(true);
      expect(t.annotations!.destructiveHint).toBe(false);
      expect(t.annotations!.idempotentHint).toBe(true);
      expect(t.annotations!.openWorldHint).toBe(true);
    }
  );

  it('allToolsWithSchema entries have outputSchema', () => {
    for (const tool of allToolsWithSchema) {
      expect(tool.outputSchema, `${tool.name} missing outputSchema`).toBeDefined();
      expect(tool.outputSchema).toHaveProperty('type', 'object');
      expect(tool.outputSchema).toHaveProperty('properties');
      const props = tool.outputSchema.properties as Record<string, unknown>;
      expect(props).toHaveProperty('success');
      expect(props).toHaveProperty('data');
      expect(props).toHaveProperty('pagination');
      expect(props).toHaveProperty('error');
    }
  });

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

  it('contains all expected tool names', () => {
    const expectedNames = [
      'threatlocker_computers', 'threatlocker_computer_groups', 'threatlocker_applications', 'threatlocker_policies',
      'threatlocker_action_log', 'threatlocker_approval_requests', 'threatlocker_organizations', 'threatlocker_reports',
      'threatlocker_maintenance_mode', 'threatlocker_scheduled_actions', 'threatlocker_system_audit', 'threatlocker_tags',
      'threatlocker_storage_policies', 'threatlocker_network_access_policies',
      'threatlocker_versions', 'threatlocker_online_devices',
    ];
    for (const name of expectedNames) {
      expect(toolsByName.has(name), `missing tool: ${name}`).toBe(true);
    }
  });
});
