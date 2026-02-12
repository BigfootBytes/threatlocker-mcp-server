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
      expect(typeof t.description).toBe('string');
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.zodSchema).toBeDefined();
      expect(typeof t.handler).toBe('function');
      // zodSchema must have an 'action' field
      expect(t.zodSchema.action).toBeDefined();
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

  it('contains all expected tool names', () => {
    const expectedNames = [
      'computers', 'computer_groups', 'applications', 'policies',
      'action_log', 'approval_requests', 'organizations', 'reports',
      'maintenance_mode', 'scheduled_actions', 'system_audit', 'tags',
      'storage_policies', 'network_access_policies',
      'threatlocker_versions', 'online_devices',
    ];
    for (const name of expectedNames) {
      expect(toolsByName.has(name), `missing tool: ${name}`).toBe(true);
    }
  });
});
