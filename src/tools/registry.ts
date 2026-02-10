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
