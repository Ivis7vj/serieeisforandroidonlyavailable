import 'react-native-reanimated';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './widget-task-handler';

try {
    registerWidgetTaskHandler(widgetTaskHandler);
} catch (e) {
    console.warn('Widget task handler could not be registered. This is expected in Expo Go.');
}

// 🚀 Standard Expo Router Entry
import 'expo-router/entry';
