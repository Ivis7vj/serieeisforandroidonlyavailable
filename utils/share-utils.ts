import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing'; // Fallback
import { Alert, Platform, Linking } from 'react-native';

// Lazy load RNShare to prevent crashes in Expo Go
let RNShare: any = null;
let Social: any = null;
try {
    const RNShareModule = require('react-native-share');
    RNShare = RNShareModule.default;
    Social = RNShareModule.Social;
} catch (e) {
    console.log("react-native-share not available (using basic sharing)");
}

export const saveToGallery = async (uri: string) => {
    try {
        // Request write-only permissions to avoid needing AUDIO reading permissions on newer Androids checking legacy scope
        const { status } = await MediaLibrary.requestPermissionsAsync(true);
        if (status !== 'granted') {
            Alert.alert("Permission Denied", "We need storage permissions to save images to your gallery.");
            return false;
        }

        const asset = await MediaLibrary.createAssetAsync(uri);
        if (Platform.OS === 'android') {
            await MediaLibrary.createAlbumAsync('Serieetales', asset, false);
        } else {
            await MediaLibrary.createAlbumAsync('Serieetales', asset, false).catch(() => { });
        }

        Alert.alert("Success", "Diary poster saved to your gallery!");
        return true;
    } catch (error) {
        console.error("Gallery Save Error:", error);
        Alert.alert("Save Failed", "Could not save directly. Opening share options...", [
            { text: "OK", onPress: () => shareNative(uri) }
        ]);
        return false;
    }
};

export const shareToInstagram = async (uri: string) => {
    // 1. Try Advanced Native Share (Stories)
    if (RNShare && Social) {
        try {
            await RNShare.shareSingle({
                social: Social.InstagramStories,
                appId: '1064049830596323',
                backgroundImage: uri,
                backgroundBottomColor: '#000000',
                backgroundTopColor: '#000000',
            });
            return;
        } catch (error) {
            console.warn("RNShare Instagram failed, trying fallback", error);
        }
    }

    // 2. Fallback: Expo Sharing (Generic)
    try {
        const storiesUrl = 'instagram-stories://share';
        const isStoriesAvailable = await Linking.canOpenURL(storiesUrl);

        if (isStoriesAvailable) {
            await Sharing.shareAsync(uri, {
                mimeType: 'image/png',
                UTI: 'com.instagram.exclusivegram',
                dialogTitle: 'Share to Instagram Story'
            });
        } else {
            await Sharing.shareAsync(uri);
        }
    } catch (error) {
        console.error("Instagram Fallback Error:", error);
        await Sharing.shareAsync(uri);
    }
};

export const shareToWhatsApp = async (uri: string, message: string = "CHECK OUT MY MONTHLY DIARY ON SERIEE APP.") => {
    // 1. Try Advanced Native Share (Direct)
    if (RNShare && Social) {
        try {
            await RNShare.shareSingle({
                social: Social.Whatsapp,
                url: uri,
                message: message,
                type: 'image/png',
            });
            return;
        } catch (error) {
            console.warn("RNShare WhatsApp failed, trying fallback", error);
        }
    }

    // 2. Fallback: Expo Sharing (Generic)
    try {
        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
        const isWhatsappAvailable = await Linking.canOpenURL(whatsappUrl);

        if (isWhatsappAvailable) {
            await Sharing.shareAsync(uri, {
                mimeType: 'image/png',
                dialogTitle: 'Share via WhatsApp',
                UTI: 'net.whatsapp.image'
            });
        } else {
            Alert.alert("WhatsApp not installed", "Sharing via standard menu instead.");
            await Sharing.shareAsync(uri);
        }
    } catch (error) {
        console.error("WhatsApp Fallback Error:", error);
        await Sharing.shareAsync(uri);
    }
};

export const shareNative = async (uri: string) => {
    // 1. Try Advanced Native Share
    if (RNShare) {
        try {
            await RNShare.open({
                url: uri,
                type: 'image/png',
                message: 'Check out my Diary on Seriee!',
                failOnCancel: false
            });
            return;
        } catch (error) {
            console.warn("RNShare Native failed, trying fallback", error);
        }
    }

    // 2. Fallback: Expo Sharing
    try {
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
            Alert.alert("Error", "Sharing is not available on this device.");
            return;
        }
        await Sharing.shareAsync(uri);
    } catch (error) {
        console.error("Native Share Error:", error);
    }
};
