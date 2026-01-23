import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// HAPTICS DISABLED BY USER REQUEST
// All functions are now no-ops

export const triggerSelection = async () => {
    // Disabled
};

export const triggerImpact = async (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    // Disabled
};

export const triggerNotification = async (type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) => {
    // Disabled
};

export const triggerSuccess = async () => {
    // Disabled
};

export { Haptics };

