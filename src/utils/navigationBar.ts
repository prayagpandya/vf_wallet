import { Platform } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export interface AdaptiveTabBarStyleResult {
  navigationType: 'gesture' | 'button-standard' | 'button-edge-to-edge' | 'ios';
  bottomPadding: number;
  tabHeight: number;
  tabBarStyle: {
    backgroundColor: string;
    borderTopColor: string;
    borderTopWidth: number;
    height: number;
    paddingBottom: number;
    paddingTop: number;
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
}

/**
 * Dynamically computes optimal bottom tab bar styling based on the device's navigation style:
 * 1. 3-Button Navigation (Standard / window stops above buttons, insets.bottom === 0):
 *    Moves the menu UP with generous bottom clearance (height 72, paddingBottom 16)
 *    so the tab buttons and labels have ample space and never collide with the system Back/Home buttons.
 * 2. 3-Button Navigation (Edge-to-Edge, insets.bottom >= 36, typically ~48dp):
 *    Lifts the menu content completely above the transparent 3-button system navigation bar.
 * 3. Gesture Navigation (insets.bottom > 0 and < 36, typically 16-24dp on Android, ~34dp on iOS):
 *    Stays cleanly attached to the very bottom edge of the screen, absorbing the gesture pill in the padding zone
 *    so tab icons and text float gracefully right above the gesture line.
 */
export function getAdaptiveTabBarStyle(insets: EdgeInsets): AdaptiveTabBarStyleResult {
  const isGestureNav = insets.bottom > 0 && insets.bottom < 36;
  const isButtonNavEdgeToEdge = insets.bottom >= 36;
  const isButtonNavStandard = insets.bottom === 0;

  let tabHeight: number;
  let tabPaddingBottom: number;
  let tabPaddingTop: number = 8;
  let navigationType: AdaptiveTabBarStyleResult['navigationType'];

  if (Platform.OS === 'ios') {
    navigationType = 'ios';
    if (insets.bottom > 0) {
      // iPhone with Home Indicator (Gesture)
      tabPaddingBottom = Math.max(insets.bottom - 4, 20);
      tabHeight = 54 + insets.bottom;
    } else {
      // iPhone with Touch ID Home Button
      tabPaddingBottom = 12;
      tabHeight = 64;
    }
  } else {
    // Android Devices
    if (isButtonNavStandard) {
      // 3-Button Navigation (Window stops above buttons):
      // Move the menu UP with generous bottom clearance so the icons/labels
      // don't feel crowded or conflict with Android's system Back/Home buttons.
      navigationType = 'button-standard';
      tabPaddingBottom = 16;
      tabPaddingTop = 8;
      tabHeight = 72;
    } else if (isButtonNavEdgeToEdge) {
      // 3-Button Navigation (Edge-to-Edge with transparent system bar ~48dp):
      // Lift the menu completely above the system navigation bar.
      navigationType = 'button-edge-to-edge';
      tabPaddingBottom = insets.bottom + 8;
      tabPaddingTop = 6;
      tabHeight = 56 + insets.bottom + 8;
    } else {
      // Gesture Navigation (Thin pill line or seamless bottom):
      // Attached flush to the bottom edge of the phone display,
      // with bottom padding perfectly cradling the gesture bar.
      navigationType = 'gesture';
      tabPaddingBottom = Math.max(insets.bottom, 10);
      tabPaddingTop = 6;
      tabHeight = 54 + insets.bottom;
    }
  }

  return {
    navigationType,
    bottomPadding: tabPaddingBottom,
    tabHeight,
    tabBarStyle: {
      backgroundColor: colors.white,
      borderTopColor: colors.cardBorder,
      borderTopWidth: 1,
      height: tabHeight,
      paddingBottom: tabPaddingBottom,
      paddingTop: tabPaddingTop,
      shadowColor: colors.shadowColor,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 8,
    },
  };
}
