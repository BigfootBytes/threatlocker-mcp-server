import { z } from 'zod';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, apiResponseOutputSchema } from '../types/responses.js';

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  annotations?: ToolAnnotations;
  zodSchema: Record<string, z.ZodTypeAny>;
  outputZodSchema?: Record<string, z.ZodTypeAny>;
  handler: (client: ThreatLockerClient, input: Record<string, unknown>) => Promise<ApiResponse<unknown>>;
  writeActions?: Set<string>;
}

/** Check if a write action is blocked by THREATLOCKER_READ_ONLY env var. */
export function isWriteBlocked(writeActions: Set<string> | undefined, action: string): boolean {
  if (!writeActions || !writeActions.has(action)) return false;
  const readOnly = process.env.THREATLOCKER_READ_ONLY;
  if (!readOnly) return false;
  return /^(true|1|yes)$/i.test(readOnly);
}

/**
 * JSON Schema dialect advertised for every tool's input and output schema.
 *
 * MCP clients validate tool schemas with a 2020-12-only validator by default. The MCP SDK's
 * own Zod->JSON Schema conversion hardcodes draft-07, so the server does its own conversion
 * and stamps the dialect explicitly rather than relying on a client-side default.
 */
export const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

/**
 * Convert a Zod shape record to a 2020-12 JSON Schema (replacing Zod's $schema, dropping
 * additionalProperties).
 *
 * `io` must match how the schema is used. Under the default 'output' view a field with a
 * `.default()` is always present once parsed, so Zod marks it required — correct for an output
 * schema, wrong for an input schema where that field is exactly what the caller may omit.
 */
export function zodShapeToJsonSchema(
  shape: Record<string, z.ZodTypeAny>,
  io: 'input' | 'output' = 'output',
): Record<string, unknown> {
  const { $schema, additionalProperties, ...rest } = z.toJSONSchema(z.object(shape), { io }) as Record<string, unknown>;
  return { $schema: JSON_SCHEMA_DIALECT, type: 'object', ...rest };
}

/**
 * Per-call options every tool accepts on top of its own input shape. Kept here as the single
 * source of truth so the registered handler and the advertised inputSchema cannot drift apart.
 */
const commonToolInputShape: Record<string, z.ZodTypeAny> = {
  response_format: z.enum(['json', 'markdown']).default('markdown')
    .describe('Output format: markdown (default, human-readable) or json (structured)'),
  fetchAllPages: z.boolean().default(false)
    .describe('Fetch all pages automatically (max 10 pages). Default: false (single page).'),
};

/** Full input shape advertised for a tool: its own parameters plus the common per-call options. */
export function toolInputShape(tool: ToolDefinition): Record<string, z.ZodTypeAny> {
  return { ...tool.zodSchema, ...commonToolInputShape };
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
import { savedSearchesTool } from './saved-searches.js';
import { uploadRequestsTool } from './upload-requests.js';

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
  savedSearchesTool,
  uploadRequestsTool,
];

export const toolsByName = new Map(allTools.map(t => [t.name, t]));

export interface ToolWithJsonSchema extends ToolDefinition {
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export const allToolsWithSchema: ToolWithJsonSchema[] = allTools.map(t => ({
  ...t,
  inputSchema: zodShapeToJsonSchema(toolInputShape(t), 'input'),
  outputSchema: zodShapeToJsonSchema(t.outputZodSchema ?? apiResponseOutputSchema),
}));
