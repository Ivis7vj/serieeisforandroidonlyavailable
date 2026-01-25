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
    updateWidgetData: (data: WidgetData) => {
        if (UpNextWidgetModule) {
            UpNextWidgetModule.updateWidgetData(data);
        } else {
            console.warn('UpNextWidgetModule not available');
        }
    }
};
