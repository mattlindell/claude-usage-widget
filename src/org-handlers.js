/**
 * org-handlers.js
 *
 * Pure logic for organization-related IPC handlers.
 * Extracted from main.js so it can be tested without Electron.
 *
 * Each function takes a `fetchOrgs` callback (wrapping fetchViaWindow)
 * and returns the same shape the IPC handler would return/throw.
 */

/**
 * Validate a session key by fetching the orgs API.
 * @param {Function} fetchOrgs - async () => parsed JSON from /api/organizations
 * @returns {Object} { success, organizationId?, organizations?, error? }
 */
async function validateSessionKey(fetchOrgs) {
  try {
    const data = await fetchOrgs();

    if (data && Array.isArray(data) && data.length > 0) {
      if (data.length === 1) {
        const orgId = data[0].uuid || data[0].id;
        return { success: true, organizationId: orgId };
      }

      const organizations = data.map(org => ({
        uuid: org.uuid || org.id,
        name: org.name,
        capabilities: org.capabilities || [],
        raven_type: org.raven_type || null
      }));
      return { success: true, organizations };
    }

    if (data && data.error) {
      return { success: false, error: data.error.message || data.error };
    }

    return { success: false, error: 'No organization found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch the list of organizations.
 * @param {Function} fetchOrgs - async () => parsed JSON from /api/organizations
 * @returns {Array} mapped org objects
 * @throws {Error} on API error or empty response
 */
async function fetchOrganizations(fetchOrgs) {
  const data = await fetchOrgs();

  if (data && Array.isArray(data) && data.length > 0) {
    return data.map(org => ({
      uuid: org.uuid || org.id,
      name: org.name,
      capabilities: org.capabilities || [],
      raven_type: org.raven_type || null
    }));
  }

  if (data && data.error) {
    throw new Error(data.error.message || data.error);
  }

  throw new Error('No organizations found');
}

/**
 * Determine how to handle a returning user's stored org.
 *
 * @param {string|null} storedOrgId - previously persisted organizationId
 * @param {Object} validationResult - output of validateSessionKey()
 * @returns {{ action: 'auto-select', orgId: string }
 *          | { action: 'show-picker', organizations: Array, message?: string }
 *          | { action: 'login-required' }}
 */
function resolveStaleOrg(storedOrgId, validationResult) {
  if (!validationResult.success) {
    return { action: 'login-required' };
  }

  // Single org response — always auto-select
  if (validationResult.organizationId) {
    return { action: 'auto-select', orgId: validationResult.organizationId };
  }

  // Multi-org response
  if (validationResult.organizations) {
    if (validationResult.organizations.length === 1) {
      return { action: 'auto-select', orgId: validationResult.organizations[0].uuid };
    }

    const stored = validationResult.organizations.find(o => o.uuid === storedOrgId);
    if (stored) {
      return { action: 'auto-select', orgId: stored.uuid };
    }

    return {
      action: 'show-picker',
      organizations: validationResult.organizations,
      message: 'Your previous organization is no longer available. Please select one.'
    };
  }

  return { action: 'login-required' };
}

module.exports = { validateSessionKey, fetchOrganizations, resolveStaleOrg };
