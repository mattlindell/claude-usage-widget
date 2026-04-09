const SETTINGS_BASE_HEIGHT = 288;
const ORG_ROW_HEIGHT = 40;
const ORG_CARD_HEIGHT = 48;
const ORG_PICKER_PADDING = 16;

/**
 * Calculate the correct settings window height based on org-row and picker state.
 * @param {{ orgRowVisible: boolean, pickerOrgCount: number }} state
 * @returns {number}
 */
export function getSettingsHeight({ orgRowVisible, pickerOrgCount }) {
  let height = SETTINGS_BASE_HEIGHT;

  if (orgRowVisible) {
    height += ORG_ROW_HEIGHT;

    if (pickerOrgCount > 0) {
      height += (pickerOrgCount * ORG_CARD_HEIGHT) + ORG_PICKER_PADDING;
    }
  }

  return height;
}

export { SETTINGS_BASE_HEIGHT, ORG_ROW_HEIGHT, ORG_CARD_HEIGHT, ORG_PICKER_PADDING };
