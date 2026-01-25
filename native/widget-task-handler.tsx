import React from 'react';
import { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { UpNextWidget } from './components/widget/UpNextWidget';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
    const { widgetAction } = props;

    if (widgetAction === 'WIDGET_UPDATE' || widgetAction === 'WIDGET_RESIZED' || widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_CLICK') {
        const defaultData = {
            seriesName: 'No Series Tracking',
            episodeInfo: 'Track now',
            backdropUri: ''
        };
        let data = defaultData;

        try {
            const dataJson = await AsyncStorage.getItem('@widget_data');
            if (dataJson) {
                data = JSON.parse(dataJson);
            }
        } catch (e) {
            console.error('Failed to load widget data from storage', e);
        }

        props.renderWidget(
            <UpNextWidget
                seriesName={data.seriesName}
                episodeInfo={data.episodeInfo}
                backdropUri={data.backdropUri}
            />
        );
    }
}
