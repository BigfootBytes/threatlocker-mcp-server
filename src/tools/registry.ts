import { z } from 'zod';
import { ThreatLockerClient } from '../client.js';
import { ApiResponse } from '../types/responses.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  zodSchema: Record<string, z.ZodTypeAny>;
  handler: (client: ThreatLockerClient, input: Record<string, unknown>) => Promise<ApiResponse<unknown>>;
}

// Tools will be added in Task 3 after all tool files export ToolDefinitions
export const allTools: ToolDefinition[] = [];

export const toolsByName = new Map(allTools.map(t => [t.name, t]));
