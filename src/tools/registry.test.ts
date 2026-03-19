import { describe, it, expect, afterEach } from 'vitest';
import { allTools, toolsByName, allToolsWithSchema, ToolDefinition, isWriteBlocked } from './registry.js';

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
      expect(typeof t.annotations!.readOnlyHint).toBe('boolean');
      expect(t.annotations!.destructiveHint).toBe(false);
      expect(typeof t.annotations!.idempotentHint).toBe('boolean');
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
      'computers', 'computer_groups', 'applications', 'policies',
      'action_log', 'approval_requests', 'organizations', 'reports',
      'maintenance_mode', 'scheduled_actions', 'system_audit', 'tags',
      'storage_policies', 'network_access_policies',
      'versions', 'online_devices',
    ];
    for (const name of expectedNames) {
      expect(toolsByName.has(name), `missing tool: ${name}`).toBe(true);
    }
  });
});

describe('isWriteBlocked', () => {
  const originalEnv = process.env.THREATLOCKER_READ_ONLY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.THREATLOCKER_READ_ONLY;
    } else {
      process.env.THREATLOCKER_READ_ONLY = originalEnv;
    }
  });

  it('returns false when THREATLOCKER_READ_ONLY is not set', () => {
    delete process.env.THREATLOCKER_READ_ONLY;
    expect(isWriteBlocked(new Set(['create']), 'create')).toBe(false);
  });

  it('returns false when THREATLOCKER_READ_ONLY is empty string', () => {
    process.env.THREATLOCKER_READ_ONLY = '';
    expect(isWriteBlocked(new Set(['create']), 'create')).toBe(false);
  });

  it('returns true when THREATLOCKER_READ_ONLY=true and action is write', () => {
    process.env.THREATLOCKER_READ_ONLY = 'true';
    expect(isWriteBlocked(new Set(['create', 'update', 'delete']), 'create')).toBe(true);
  });

  it('returns true when THREATLOCKER_READ_ONLY=1', () => {
    process.env.THREATLOCKER_READ_ONLY = '1';
    expect(isWriteBlocked(new Set(['create']), 'create')).toBe(true);
  });

  it('returns true when THREATLOCKER_READ_ONLY=yes', () => {
    process.env.THREATLOCKER_READ_ONLY = 'yes';
    expect(isWriteBlocked(new Set(['create']), 'create')).toBe(true);
  });

  it('returns true when THREATLOCKER_READ_ONLY=TRUE (case insensitive)', () => {
    process.env.THREATLOCKER_READ_ONLY = 'TRUE';
    expect(isWriteBlocked(new Set(['create']), 'create')).toBe(true);
  });

  it('returns false when action is a read action even in read-only mode', () => {
    process.env.THREATLOCKER_READ_ONLY = 'true';
    expect(isWriteBlocked(new Set(['create']), 'search')).toBe(false);
  });

  it('returns false when writeActions is undefined', () => {
    process.env.THREATLOCKER_READ_ONLY = 'true';
    expect(isWriteBlocked(undefined, 'search')).toBe(false);
  });

  it('returns false for non-truthy values like "false"', () => {
    process.env.THREATLOCKER_READ_ONLY = 'false';
    expect(isWriteBlocked(new Set(['create']), 'create')).toBe(false);
  });
});
