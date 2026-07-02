import { z } from 'zod';
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse, validateGuid, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof uploadRequestsZodSchema>>;

export async function handleUploadRequestsTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const { action } = input as ToolInput;

  const uploadRequestId = input.uploadRequestId as string | undefined;
  const organizationId = input.organizationId as string | undefined;
  const computerId = input.computerId as string | undefined;

  switch (action) {
    case 'insert': {
      if (!uploadRequestId) return errorResponse('BAD_REQUEST', 'uploadRequestId (a new GUID) is required for insert action');
      const urError = validateGuid(uploadRequestId, 'uploadRequestId');
      if (urError) return urError;
      if (!organizationId) return errorResponse('BAD_REQUEST', 'organizationId is required for insert action');
      const orgError = validateGuid(organizationId, 'organizationId');
      if (orgError) return orgError;
      if (!computerId) return errorResponse('BAD_REQUEST', 'computerId is required for insert action');
      const cError = validateGuid(computerId, 'computerId');
      if (cError) return cError;
      return client.post('UploadRequest/UploadRequestInsert', {
        uploadRequestId,
        organizationId,
        computerId,
        shA256: input.shA256,
        hash: input.hash,
        filename: input.filename,
        filepath: input.filepath,
      });
    }

    case 'get': {
      if (!uploadRequestId) return errorResponse('BAD_REQUEST', 'uploadRequestId is required for get action');
      const urError = validateGuid(uploadRequestId, 'uploadRequestId');
      if (urError) return urError;
      return client.post('UploadRequest/UploadRequestGet', {
        uploadRequestId,
        organizationId,
        computerId,
        shA256: input.shA256,
        hash: input.hash,
        filename: input.filename,
        filepath: input.filepath,
      });
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const uploadRequestsZodSchema = {
  action: z.enum(['insert', 'get']).describe('insert=request a file upload from an endpoint (forensics), get=retrieve an upload request'),
  uploadRequestId: z.string().max(100).optional().describe('Upload-request GUID. For insert, supply a NEW GUID; for get, the existing one.'),
  organizationId: z.string().max(100).optional().describe('Organization GUID (required for insert).'),
  computerId: z.string().max(100).optional().describe('Computer GUID the file lives on (required for insert).'),
  shA256: z.string().max(200).optional().describe('SHA-256 of the file (note the API field casing "shA256").'),
  hash: z.string().max(200).optional().describe('ThreatLocker hash of the file.'),
  filename: z.string().max(500).optional().describe('File name to upload.'),
  filepath: z.string().max(2000).optional().describe('Full file path (use \\\\ for backslashes).'),
};

const uploadRequestObject = z.object({
  uploadRequestId: z.string().nullable(),
  organizationId: z.string().nullable().optional(),
  computerId: z.string().nullable().optional(),
  shA256: z.string().nullable().optional(),
  filename: z.string().nullable().optional(),
  filepath: z.string().nullable().optional(),
}).passthrough();

export const uploadRequestsOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    uploadRequestObject.describe('get: upload request details'),
    z.any().describe('insert: operation result'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const uploadRequestsTool: ToolDefinition = {
  name: 'upload_requests',
  title: 'ThreatLocker Upload Requests',
  description: `Request and retrieve forensic file uploads from endpoints.

Common workflows:
- Request a file upload: action=insert, uploadRequestId=<new GUID>, organizationId="...", computerId="...", shA256="..." (or filepath)
- Retrieve an upload request: action=get, uploadRequestId="..."

Pitfalls:
- The SHA-256 field is literally "shA256" (odd casing) in the API.
- insert requires you to supply a fresh uploadRequestId GUID.
- Writes are payload-verified, NOT live-tested.

Permissions: View Unified Audit / forensics.

Related tools: action_log (locate the file event), computers (get computerId)`,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  zodSchema: uploadRequestsZodSchema,
  outputZodSchema: uploadRequestsOutputZodSchema,
  writeActions: new Set(['insert']),
  handler: handleUploadRequestsTool,
};
