import { describe, it, expect } from 'vitest';
import { getSettingsHeight } from '../src/settings-height.js';

describe('getSettingsHeight', () => {
  const BASE_HEIGHT = 288;
  const ORG_ROW_HEIGHT = 40;

  it('returns base height when org-row is not visible', () => {
    const height = getSettingsHeight({ orgRowVisible: false, pickerOrgCount: 0 });
    expect(height).toBe(BASE_HEIGHT);
  });

  it('returns base + org-row height when org-row is visible', () => {
    const height = getSettingsHeight({ orgRowVisible: true, pickerOrgCount: 0 });
    expect(height).toBe(BASE_HEIGHT + ORG_ROW_HEIGHT);
  });

  it('returns expanded height when org picker is open', () => {
    const orgCount = 3;
    const height = getSettingsHeight({ orgRowVisible: true, pickerOrgCount: orgCount });
    // picker adds per-org card height + padding
    expect(height).toBe(BASE_HEIGHT + ORG_ROW_HEIGHT + (orgCount * 48) + 16);
  });

  it('ignores picker org count when org-row is not visible', () => {
    const height = getSettingsHeight({ orgRowVisible: false, pickerOrgCount: 3 });
    expect(height).toBe(BASE_HEIGHT);
  });

  it('returns at least base height even with zero orgs in picker', () => {
    const height = getSettingsHeight({ orgRowVisible: true, pickerOrgCount: 0 });
    expect(height).toBeGreaterThanOrEqual(BASE_HEIGHT);
  });
});
