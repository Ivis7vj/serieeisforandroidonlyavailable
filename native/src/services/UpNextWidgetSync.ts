import { NativeModules } from 'react-native';

const { UpNextWidgetModule } = NativeModules;

interface WidgetData {
    seriesName: string;
    episodeInfo: string;
    backdropUri: string;
    seriesId: number;
    seasonNumber: number;
    episodeNumber: number;
}

export const UpNextWidgetSync = {
    updateWidgetData: (dataList: WidgetData[]) => {
        if (UpNextWidgetModule) {
            // Native module expects a JSON string for the array
            // We use the new method name 'updateWidgetDataJson' we added in Kotlin
            // Or if we check the Kotlin file, I added 'updateWidgetDataJson'
            const jsonString = JSON.stringify(dataList);
            if (UpNextWidgetModule.updateWidgetDataJson) {
                UpNextWidgetModule.updateWidgetDataJson(jsonString);
            } else {
                // Fallback or error if method missing (should be there after rebuild)
                console.warn('Native Method updateWidgetDataJson not found');
            }
        } else {
            console.warn('UpNextWidgetModule not available');
        }
    }
};
