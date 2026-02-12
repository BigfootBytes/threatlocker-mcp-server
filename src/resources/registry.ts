import { ENUMS } from './enums.js';
import { VERSION } from '../version.js';
import { allTools } from '../tools/registry.js';

export interface ResourceDefinition {
  name: string;
  uri: string;
  description: string;
  mimeType: string;
  getData: () => unknown;
}

export const allResources: ResourceDefinition[] = [
  {
    name: 'enums',
    uri: 'threatlocker://enums',
    description: 'ThreatLocker API enumeration values (OS types, action IDs, maintenance types, approval statuses, etc.)',
    mimeType: 'application/json',
    getData: () => ENUMS,
  },
  {
    name: 'server-info',
    uri: 'threatlocker://server/info',
    description: 'ThreatLocker MCP server metadata (name, version, tool count, transports, protocol version)',
    mimeType: 'application/json',
    getData: () => ({
      name: 'threatlocker-mcp-server',
      version: VERSION,
      toolCount: allTools.length,
      transports: ['stdio', 'sse', 'streamable-http'],
      protocolVersion: '2025-03-26',
    }),
  },
];
