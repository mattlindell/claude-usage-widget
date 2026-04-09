import { describe, it, expect, vi } from 'vitest';
import { validateSessionKey, fetchOrganizations, resolveStaleOrg } from '../src/org-handlers.js';

// --- Fixtures ---

const ORG_PERSONAL = {
  uuid: 'org-111-aaa',
  name: 'Personal',
  capabilities: ['chat', 'code'],
  raven_type: 'free'
};

const ORG_WORK = {
  uuid: 'org-222-bbb',
  name: 'Acme Corp',
  capabilities: ['chat', 'code', 'admin'],
  raven_type: 'enterprise'
};

function makeFetchOrgs(response) {
  return vi.fn().mockResolvedValue(response);
}

function makeFetchOrgsError(message) {
  return vi.fn().mockRejectedValue(new Error(message));
}

// ─── validate-session-key ────────────────────────────────────────────

describe('validateSessionKey', () => {
  it('single-org response returns success with organizationId', async () => {
    const fetchOrgs = makeFetchOrgs([ORG_PERSONAL]);
    const result = await validateSessionKey(fetchOrgs);

    expect(result).toEqual({
      success: true,
      organizationId: 'org-111-aaa'
    });
  });

  it('multi-org response returns success with organizations array', async () => {
    const fetchOrgs = makeFetchOrgs([ORG_PERSONAL, ORG_WORK]);
    const result = await validateSessionKey(fetchOrgs);

    expect(result).toEqual({
      success: true,
      organizations: [
        { uuid: 'org-111-aaa', name: 'Personal', capabilities: ['chat', 'code'], raven_type: 'free' },
        { uuid: 'org-222-bbb', name: 'Acme Corp', capabilities: ['chat', 'code', 'admin'], raven_type: 'enterprise' }
      ]
    });
  });

  it('falls back to id field when uuid is missing', async () => {
    const fetchOrgs = makeFetchOrgs([{ id: 'fallback-id', name: 'Test' }]);
    const result = await validateSessionKey(fetchOrgs);

    expect(result).toEqual({
      success: true,
      organizationId: 'fallback-id'
    });
  });

  it('empty org array returns failure', async () => {
    const fetchOrgs = makeFetchOrgs([]);
    const result = await validateSessionKey(fetchOrgs);

    expect(result).toEqual({
      success: false,
      error: 'No organization found'
    });
  });

  it('API error object returns failure with message', async () => {
    const fetchOrgs = makeFetchOrgs({ error: { message: 'Invalid token' } });
    const result = await validateSessionKey(fetchOrgs);

    expect(result).toEqual({
      success: false,
      error: 'Invalid token'
    });
  });

  it('API error string returns failure', async () => {
    const fetchOrgs = makeFetchOrgs({ error: 'Unauthorized' });
    const result = await validateSessionKey(fetchOrgs);

    expect(result).toEqual({
      success: false,
      error: 'Unauthorized'
    });
  });

  it('network/Cloudflare error returns failure', async () => {
    const fetchOrgs = makeFetchOrgsError('CloudflareBlocked: Just a moment');
    const result = await validateSessionKey(fetchOrgs);

    expect(result).toEqual({
      success: false,
      error: 'CloudflareBlocked: Just a moment'
    });
  });

  it('defaults missing capabilities and raven_type in multi-org', async () => {
    const fetchOrgs = makeFetchOrgs([
      { uuid: 'a', name: 'A' },
      { uuid: 'b', name: 'B' }
    ]);
    const result = await validateSessionKey(fetchOrgs);

    expect(result.success).toBe(true);
    expect(result.organizations[0]).toEqual({
      uuid: 'a', name: 'A', capabilities: [], raven_type: null
    });
  });
});

// ─── fetch-organizations ─────────────────────────────────────────────

describe('fetchOrganizations', () => {
  it('returns mapped org list on success', async () => {
    const fetchOrgs = makeFetchOrgs([ORG_PERSONAL, ORG_WORK]);
    const result = await fetchOrganizations(fetchOrgs);

    expect(result).toEqual([
      { uuid: 'org-111-aaa', name: 'Personal', capabilities: ['chat', 'code'], raven_type: 'free' },
      { uuid: 'org-222-bbb', name: 'Acme Corp', capabilities: ['chat', 'code', 'admin'], raven_type: 'enterprise' }
    ]);
  });

  it('throws on API error response', async () => {
    const fetchOrgs = makeFetchOrgs({ error: { message: 'Forbidden' } });

    await expect(fetchOrganizations(fetchOrgs)).rejects.toThrow('Forbidden');
  });

  it('throws on empty array', async () => {
    const fetchOrgs = makeFetchOrgs([]);

    await expect(fetchOrganizations(fetchOrgs)).rejects.toThrow('No organizations found');
  });

  it('throws on network error', async () => {
    const fetchOrgs = makeFetchOrgsError('Request timeout');

    await expect(fetchOrganizations(fetchOrgs)).rejects.toThrow('Request timeout');
  });

  it('falls back to id field when uuid is missing', async () => {
    const fetchOrgs = makeFetchOrgs([{ id: 'fb-1', name: 'Fallback' }]);
    const result = await fetchOrganizations(fetchOrgs);

    expect(result[0].uuid).toBe('fb-1');
  });
});

// ─── resolveStaleOrg ─────────────────────────────────────────────────

describe('resolveStaleOrg', () => {
  it('stored org present in org list → auto-select', () => {
    const validation = {
      success: true,
      organizations: [
        { uuid: 'org-111-aaa', name: 'Personal', capabilities: [], raven_type: null },
        { uuid: 'org-222-bbb', name: 'Acme Corp', capabilities: [], raven_type: null }
      ]
    };
    const result = resolveStaleOrg('org-111-aaa', validation);

    expect(result).toEqual({ action: 'auto-select', orgId: 'org-111-aaa' });
  });

  it('stored org NOT in org list → show picker with warning', () => {
    const validation = {
      success: true,
      organizations: [
        { uuid: 'org-222-bbb', name: 'Acme Corp', capabilities: [], raven_type: null }
      ]
    };
    // Note: single org in the organizations array still gets auto-selected
    // This tests with 2+ orgs where the stored one is missing
    const validationMulti = {
      success: true,
      organizations: [
        { uuid: 'org-222-bbb', name: 'Acme Corp', capabilities: [], raven_type: null },
        { uuid: 'org-333-ccc', name: 'Other', capabilities: [], raven_type: null }
      ]
    };
    const result = resolveStaleOrg('org-111-aaa', validationMulti);

    expect(result).toEqual({
      action: 'show-picker',
      organizations: validationMulti.organizations,
      message: 'Your previous organization is no longer available. Please select one.'
    });
  });

  it('single org in list → auto-select regardless of stored orgId', () => {
    const validation = {
      success: true,
      organizations: [
        { uuid: 'org-222-bbb', name: 'Acme Corp', capabilities: [], raven_type: null }
      ]
    };
    const result = resolveStaleOrg('org-old-deleted', validation);

    expect(result).toEqual({ action: 'auto-select', orgId: 'org-222-bbb' });
  });

  it('single org from organizationId field → auto-select', () => {
    const validation = { success: true, organizationId: 'org-111-aaa' };
    const result = resolveStaleOrg('org-111-aaa', validation);

    expect(result).toEqual({ action: 'auto-select', orgId: 'org-111-aaa' });
  });

  it('failed validation → login required', () => {
    const validation = { success: false, error: 'Invalid token' };
    const result = resolveStaleOrg('org-111-aaa', validation);

    expect(result).toEqual({ action: 'login-required' });
  });

  it('null stored org with multi-org → show picker', () => {
    const validation = {
      success: true,
      organizations: [
        { uuid: 'org-111-aaa', name: 'Personal', capabilities: [], raven_type: null },
        { uuid: 'org-222-bbb', name: 'Acme Corp', capabilities: [], raven_type: null }
      ]
    };
    const result = resolveStaleOrg(null, validation);

    expect(result).toEqual({
      action: 'show-picker',
      organizations: validation.organizations,
      message: 'Your previous organization is no longer available. Please select one.'
    });
  });
});
