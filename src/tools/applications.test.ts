import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleApplicationsTool, applicationsZodSchema, applicationsTool } from './applications.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('applications tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(applicationsTool.name).toBe('applications');
    expect(applicationsZodSchema.action.options).toContain('search');
    expect(applicationsZodSchema.action.options).toContain('get');
    expect(applicationsZodSchema.action.options).toContain('research');
    expect(applicationsZodSchema.action.options).toContain('files');
    expect(applicationsZodSchema.action.options).toContain('create');
    expect(applicationsZodSchema.action.options).toContain('update');
    expect(applicationsZodSchema.action.options).toContain('add_file');
    expect(applicationsZodSchema.action.options).toContain('delete');
    expect(applicationsZodSchema.action.options).toContain('delete_confirm');
  });

  it('returns error for missing action', async () => {
    const result = await handleApplicationsTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('returns error for get without applicationId', async () => {
    const result = await handleApplicationsTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
  });

  it('returns error for research without applicationId', async () => {
    const result = await handleApplicationsTool(mockClient, { action: 'research' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for search action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleApplicationsTool(mockClient, { action: 'search', searchText: 'chrome' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Application/ApplicationGetByParameters',
      expect.objectContaining({ searchText: 'chrome' }),
      expect.any(Function)
    );
  });

  it('passes sort and filter parameters for search action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleApplicationsTool(mockClient, {
      action: 'search',
      orderBy: 'date-created',
      isAscending: false,
      includeChildOrganizations: true,
      permittedApplications: true,
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Application/ApplicationGetByParameters',
      expect.objectContaining({
        orderBy: 'date-created',
        isAscending: false,
        includeChildOrganizations: true,
        permittedApplications: true,
      }),
      expect.any(Function)
    );
  });

  it('passes countries array for country search', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleApplicationsTool(mockClient, {
      action: 'search',
      searchBy: 'countries',
      countries: ['US', 'GB'],
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Application/ApplicationGetByParameters',
      expect.objectContaining({
        searchBy: 'countries',
        countries: ['US', 'GB'],
      }),
      expect.any(Function)
    );
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApplicationsTool(mockClient, { action: 'get', applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Application/ApplicationGetById',
      { applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' }
    );
  });

  it('calls correct endpoint for research action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApplicationsTool(mockClient, { action: 'research', applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Application/ApplicationGetResearchDetailsById',
      { applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' }
    );
  });

  it('returns error for files without applicationId', async () => {
    const result = await handleApplicationsTool(mockClient, { action: 'files' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for files action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleApplicationsTool(mockClient, { action: 'files', applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ApplicationFile/ApplicationFileGetByApplicationId',
      expect.objectContaining({ applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' })
    );
  });

  it('calls correct endpoint for match action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    const validSha256 = 'a'.repeat(64);
    await handleApplicationsTool(mockClient, { action: 'match', hash: validSha256, osType: 1 });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Application/ApplicationGetMatchingList',
      expect.objectContaining({ osType: 1, hash: validSha256 })
    );
  });

  it('returns error for invalid hash format in match', async () => {
    const result = await handleApplicationsTool(mockClient, {
      action: 'match',
      hash: 'not-a-valid-sha256',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('hash must be a 64-character hex string (SHA256)');
    }
  });

  it('calls correct endpoint for get_for_maintenance action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleApplicationsTool(mockClient, { action: 'get_for_maintenance' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Application/ApplicationGetForMaintenanceMode',
      {}
    );
  });

  it('calls correct endpoint for get_for_network_policy action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApplicationsTool(mockClient, { action: 'get_for_network_policy', applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Application/ApplicationGetForNetworkPolicyProcessById',
      { applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' }
    );
  });

  it('returns error for get_for_network_policy without applicationId', async () => {
    const result = await handleApplicationsTool(mockClient, { action: 'get_for_network_policy' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('applicationId');
    }
  });

  describe('create action', () => {
    it('returns error when name is missing', async () => {
      const result = await handleApplicationsTool(mockClient, { action: 'create', osType: 1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('name');
      }
    });

    it('calls ApplicationInsert with correct body', async () => {
      vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: { applicationId: 'new-id' } });
      await handleApplicationsTool(mockClient, {
        action: 'create',
        name: 'My App',
        osType: 1,
        description: 'Test app',
      });
      expect(mockClient.post).toHaveBeenCalledWith(
        'Application/ApplicationInsert',
        expect.objectContaining({
          name: 'My App',
          osType: 1,
          description: 'Test app',
          applicationFileUpdates: [],
        })
      );
    });
  });

  describe('update action', () => {
    it('returns error when applicationId is missing', async () => {
      const result = await handleApplicationsTool(mockClient, { action: 'update', name: 'X', osType: 1 });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('applicationId');
    });

    it('returns error when name is missing', async () => {
      const result = await handleApplicationsTool(mockClient, {
        action: 'update',
        applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        osType: 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('name');
    });

    it('returns error for invalid applicationId GUID', async () => {
      const result = await handleApplicationsTool(mockClient, {
        action: 'update',
        applicationId: 'not-a-guid',
        name: 'Test',
        osType: 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('applicationId must be a valid GUID');
    });

    it('calls ApplicationUpdateById with PUT', async () => {
      vi.mocked(mockClient.put).mockResolvedValue({ success: true, data: {} });
      await handleApplicationsTool(mockClient, {
        action: 'update',
        applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        name: 'Updated App',
        osType: 1,
        description: 'Updated desc',
      });
      expect(mockClient.put).toHaveBeenCalledWith(
        'Application/ApplicationUpdateById',
        expect.objectContaining({
          applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          name: 'Updated App',
          osType: 1,
          description: 'Updated desc',
        })
      );
    });
  });

  describe('add_file action', () => {
    it('returns error when applicationId is missing', async () => {
      const result = await handleApplicationsTool(mockClient, {
        action: 'add_file',
        fileRules: [{ hash: 'a'.repeat(64) }],
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('applicationId');
    });

    it('returns error when fileRules is missing', async () => {
      const result = await handleApplicationsTool(mockClient, {
        action: 'add_file',
        applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('fileRules');
    });

    it('calls PrepareForInsert then FileInsert for each rule', async () => {
      const prepared = { applicationFileId: 0, hash: 'a'.repeat(64), notes: 'auto-generated' };
      const inserted = { applicationFileId: 123, hash: 'a'.repeat(64) };
      vi.mocked(mockClient.post)
        .mockResolvedValueOnce({ success: true, data: prepared })
        .mockResolvedValueOnce({ success: true, data: inserted });

      const result = await handleApplicationsTool(mockClient, {
        action: 'add_file',
        applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        osType: 1,
        fileRules: [{ hash: 'a'.repeat(64) }],
      });

      expect(mockClient.post).toHaveBeenCalledTimes(2);
      expect(mockClient.post).toHaveBeenNthCalledWith(1,
        'ApplicationFile/ApplicationFilePrepareForInsert',
        expect.objectContaining({
          applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          hash: 'a'.repeat(64),
          isHashOnly: true,
        })
      );
      expect(mockClient.post).toHaveBeenNthCalledWith(2,
        'ApplicationFile/ApplicationFileInsert',
        prepared
      );
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as { succeeded: number; failed: number };
        expect(data.succeeded).toBe(1);
        expect(data.failed).toBe(0);
      }
    });

    it('sets isHashOnly=false when path is provided', async () => {
      vi.mocked(mockClient.post)
        .mockResolvedValueOnce({ success: true, data: {} })
        .mockResolvedValueOnce({ success: true, data: {} });

      await handleApplicationsTool(mockClient, {
        action: 'add_file',
        applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        osType: 1,
        fileRules: [{ fullPath: 'C:\\app.exe', cert: 'CN=Test' }],
      });

      expect(mockClient.post).toHaveBeenNthCalledWith(1,
        'ApplicationFile/ApplicationFilePrepareForInsert',
        expect.objectContaining({ isHashOnly: false, fullPath: 'C:\\app.exe', cert: 'CN=Test' })
      );
    });

    it('reports partial failures without stopping', async () => {
      vi.mocked(mockClient.post)
        .mockResolvedValueOnce({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid hash' } })
        .mockResolvedValueOnce({ success: true, data: { prepared: true } })
        .mockResolvedValueOnce({ success: true, data: { inserted: true } });

      const result = await handleApplicationsTool(mockClient, {
        action: 'add_file',
        applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        osType: 1,
        fileRules: [
          { hash: 'bad' },
          { hash: 'a'.repeat(64) },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as { succeeded: number; failed: number };
        expect(data.succeeded).toBe(1);
        expect(data.failed).toBe(1);
      }
    });
  });

  describe('delete action', () => {
    it('returns error when applications array is missing', async () => {
      const result = await handleApplicationsTool(mockClient, { action: 'delete' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('applications');
    });

    it('returns error when applications array is empty', async () => {
      const result = await handleApplicationsTool(mockClient, { action: 'delete', applications: [] });
      expect(result.success).toBe(false);
    });

    it('returns error for invalid GUID in applications array', async () => {
      const result = await handleApplicationsTool(mockClient, {
        action: 'delete',
        applications: [{ applicationId: 'bad-guid', name: 'Test', organizationId: '12345678-1234-1234-1234-123456789abc', osType: 1 }],
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('applicationId must be a valid GUID');
    });

    it('calls ApplicationUpdateForDelete with correct body', async () => {
      vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: true });
      const apps = [{ applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', name: 'Test', organizationId: '12345678-1234-1234-1234-123456789abc', osType: 1 }];
      await handleApplicationsTool(mockClient, { action: 'delete', applications: apps });
      expect(mockClient.post).toHaveBeenCalledWith(
        'Application/ApplicationUpdateForDelete',
        { applications: apps }
      );
    });
  });

  describe('delete_confirm action', () => {
    it('calls ApplicationConfirmUpdateForDelete', async () => {
      vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: true });
      const apps = [{ applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', name: 'Test', organizationId: '12345678-1234-1234-1234-123456789abc', osType: 1 }];
      await handleApplicationsTool(mockClient, { action: 'delete_confirm', applications: apps });
      expect(mockClient.post).toHaveBeenCalledWith(
        'Application/ApplicationConfirmUpdateForDelete',
        { applications: apps }
      );
    });
  });
});
