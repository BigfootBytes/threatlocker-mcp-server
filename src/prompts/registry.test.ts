import { describe, it, expect } from 'vitest';
import { allPrompts } from './registry.js';

describe('prompts registry', () => {
  it('has 4 prompts', () => {
    expect(allPrompts).toHaveLength(4);
  });

  it('has expected prompt names', () => {
    const names = allPrompts.map(p => p.name);
    expect(names).toEqual([
      'investigate_denial',
      'review_approval_requests',
      'security_posture_report',
      'computer_audit',
    ]);
  });

  it('every prompt has title, description, and cb', () => {
    for (const prompt of allPrompts) {
      expect(prompt.title).toBeTruthy();
      expect(prompt.description).toBeTruthy();
      expect(typeof prompt.cb).toBe('function');
    }
  });

  it('investigate_denial cb returns messages array with role and content', () => {
    const prompt = allPrompts.find(p => p.name === 'investigate_denial')!;
    const result = prompt.cb({});
    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].content).toBeDefined();
  });

  it('investigate_denial includes hostname and path when provided', () => {
    const prompt = allPrompts.find(p => p.name === 'investigate_denial')!;
    const result = prompt.cb({ hostname: 'WORKSTATION-01', path: 'C:\\app.exe' });
    const text = (result.messages[0].content as { text: string }).text;
    expect(text).toContain('WORKSTATION-01');
    expect(text).toContain('C:\\app.exe');
  });

  it('computer_audit argsSchema requires computer_name', () => {
    const prompt = allPrompts.find(p => p.name === 'computer_audit')!;
    expect(prompt.argsSchema).toBeDefined();
    expect(prompt.argsSchema!.computer_name).toBeDefined();
  });

  it('computer_audit cb includes computer name in message', () => {
    const prompt = allPrompts.find(p => p.name === 'computer_audit')!;
    const result = prompt.cb({ computer_name: 'SERVER-DC01' });
    const text = (result.messages[0].content as { text: string }).text;
    expect(text).toContain('SERVER-DC01');
  });

  it('review_approval_requests has no argsSchema', () => {
    const prompt = allPrompts.find(p => p.name === 'review_approval_requests')!;
    expect(prompt.argsSchema).toBeUndefined();
  });

  it('security_posture_report cb uses default timeframe', () => {
    const prompt = allPrompts.find(p => p.name === 'security_posture_report')!;
    const result = prompt.cb({});
    const text = (result.messages[0].content as { text: string }).text;
    expect(text).toContain('last 7 days');
  });

  it('security_posture_report cb uses provided timeframe', () => {
    const prompt = allPrompts.find(p => p.name === 'security_posture_report')!;
    const result = prompt.cb({ timeframe: 'last 30 days' });
    const text = (result.messages[0].content as { text: string }).text;
    expect(text).toContain('last 30 days');
  });
});
