import 'react-native-reanimated';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './widget-task-handler';

try {
    registerWidgetTaskHandler(widgetTaskHandler);
} catch (e) {
    console.warn('Widget task handler could not be registered.');
}
console.log("Widgets imported");
import 'expo-router/entry';
console.log("Expo Router imported");
