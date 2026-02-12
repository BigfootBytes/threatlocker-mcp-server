import { z } from 'zod';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, apiResponseOutputSchema } from '../types/responses.js';

export interface ToolDefinition {
  name: string;
  description: string;
  annotations?: ToolAnnotations;
  zodSchema: Record<string, z.ZodTypeAny>;
  outputZodSchema?: Record<string, z.ZodTypeAny>;
  handler: (client: ThreatLockerClient, input: Record<string, unknown>) => Promise<ApiResponse<unknown>>;
}

/** Convert a Zod shape record to JSON Schema (stripping Zod-specific $schema and additionalProperties). */
export function zodShapeToJsonSchema(shape: Record<string, z.ZodTypeAny>): Record<string, unknown> {
  const { $schema, additionalProperties, ...rest } = z.toJSONSchema(z.object(shape)) as Record<string, unknown>;
  return { type: 'object', ...rest };
}

import { computersTool } from './computers.js';
import { computerGroupsTool } from './computer-groups.js';
import { applicationsTool } from './applications.js';
import { policiesTool } from './policies.js';
import { actionLogTool } from './action-log.js';
import { approvalRequestsTool } from './approval-requests.js';
import { organizationsTool } from './organizations.js';
import { reportsTool } from './reports.js';
import { maintenanceModeTool } from './maintenance-mode.js';
import { scheduledActionsTool } from './scheduled-actions.js';
import { systemAuditTool } from './system-audit.js';
import { tagsTool } from './tags.js';
import { storagePoliciesTool } from './storage-policies.js';
import { networkAccessPoliciesTool } from './network-access-policies.js';
import { threatlockerVersionsTool } from './threatlocker-versions.js';
import { onlineDevicesTool } from './online-devices.js';

export const allTools: ToolDefinition[] = [
  computersTool,
  computerGroupsTool,
  applicationsTool,
  policiesTool,
  actionLogTool,
  approvalRequestsTool,
  organizationsTool,
  reportsTool,
  maintenanceModeTool,
  scheduledActionsTool,
  systemAuditTool,
  tagsTool,
  storagePoliciesTool,
  networkAccessPoliciesTool,
  threatlockerVersionsTool,
  onlineDevicesTool,
];

export const toolsByName = new Map(allTools.map(t => [t.name, t]));

export interface ToolWithJsonSchema extends ToolDefinition {
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export const allToolsWithSchema: ToolWithJsonSchema[] = allTools.map(t => ({
  ...t,
  inputSchema: zodShapeToJsonSchema(t.zodSchema),
  outputSchema: zodShapeToJsonSchema(t.outputZodSchema ?? apiResponseOutputSchema),
}));
