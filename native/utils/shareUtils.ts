import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

export const generateAndShareSticker = async (viewRef: any, width?: number, height?: number) => {
    try {
        // High Quality Capture: Use provided dimensions or default to view's size
        const options: any = {
            format: 'png',
            quality: 1.0,
            result: 'tmpfile',
        };

        if (width) options.width = width;
        if (height) options.height = height;

        const uri = await captureRef(viewRef, options);

        // Use Expo Sharing for better file/image support (Instagram Stories etc)
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
                mimeType: 'image/png',
                dialogTitle: 'Share your Series Graph',
                UTI: 'public.png' // iOS
            });
        }
    } catch (error) {
        console.error("Share failed", error);
    }
};
