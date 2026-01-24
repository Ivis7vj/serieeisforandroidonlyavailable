import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import { db } from './firebase';
import { doc, updateDoc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { supabase } from './supabase';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export const notificationService = {
    /**
     * Request permissions and get the push token
     */
    registerForPushNotificationsAsync: async (userId: string) => {
        if (!Device.isDevice) {
            console.warn('Must use physical device for Push Notifications');
            return null;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.warn('Failed to get push token for push notification!');
            return null;
        }

        try {
            console.log('[NotificationService] Getting Native Push Token...');
            // In release APKs, we use getDevicePushTokenAsync to get the native FCM token
            const token = (await Notifications.getDevicePushTokenAsync()).data;
            console.log('[NotificationService] Native Push Token obtained:', token);

            // Save to Firestore
            if (userId) {
                console.log('[NotificationService] Saving token to Firestore users/' + userId);
                const userRef = doc(db, 'users', userId);
                await updateDoc(userRef, {
                    pushToken: token,
                    notificationsEnabled: true,
                    lastTokenUpdate: new Date().toISOString()
                });
                console.log('[NotificationService] Firestore update complete');
                console.log('[NotificationService] Firestore update complete');
            }

            return token;
        } catch (error: any) {
            console.error('[NotificationService] Error getting token:', error.message);
            Alert.alert('Push Registration Error', error.message);
            return null;
        }
    },

    /**
     * Check if user is implicitly subscribed to a series
     */
    isUserSubscribed: async (userId: string, tmdbId: number) => {
        try {
            // Check Watchlist
            const { data: watchlist } = await supabase
                .from('watchlist')
                .select('id')
                .eq('user_id', userId)
                .eq('tmdb_id', tmdbId)
                .maybeSingle();
            if (watchlist) return true;

            // Check Watched Episodes
            const { data: watched } = await supabase
                .from('watched_episodes')
                .select('id')
                .eq('user_id', userId)
                .eq('tmdb_id', tmdbId)
                .limit(1);
            if (watched && watched.length > 0) return true;

            // Check Ratings (Season or Episode)
            const [sRating, eRating] = await Promise.all([
                supabase.from('season_ratings').select('id').eq('user_id', userId).eq('tmdb_id', tmdbId).limit(1),
                supabase.from('episode_ratings').select('id').eq('user_id', userId).eq('tmdb_id', tmdbId).limit(1)
            ]);
            if (sRating.data?.length || eRating.data?.length) return true;

            // Check Likes
            const { data: like } = await supabase
                .from('likes')
                .select('id')
                .eq('user_id', userId)
                .eq('tmdb_id', tmdbId)
                .limit(1);
            if (like && like.length > 0) return true;

            return false;
        } catch (error) {
            console.error('[NotificationService] Subscription check failed:', error);
            return false;
        }
    },

    /**
     * Get user notification settings
     */
    getSettings: async (userId: string) => {
        try {
            const userRef = doc(db, 'users', userId);
            const snap = await getDoc(userRef);
            if (snap.exists()) {
                const data = snap.data();
                return {
                    newEpisodes: data.notifyNewEpisodes ?? true,
                    newSeasons: data.notifyNewSeasons ?? true,
                    weeklyPicks: data.notifyWeeklyPicks ?? false
                };
            }
            return { newEpisodes: true, newSeasons: true, weeklyPicks: false };
        } catch (error) {
            console.error('[NotificationService] Get settings error:', error);
            return { newEpisodes: true, newSeasons: true, weeklyPicks: false };
        }
    },

    /**
     * Update user notification settings
     */
    updateSettings: async (userId: string, settings: { newEpisodes?: boolean, newSeasons?: boolean, weeklyPicks?: boolean }) => {
        try {
            const userRef = doc(db, 'users', userId);
            const updates: any = {};
            if (settings.newEpisodes !== undefined) updates.notifyNewEpisodes = settings.newEpisodes;
            if (settings.newSeasons !== undefined) updates.notifyNewSeasons = settings.newSeasons;
            if (settings.weeklyPicks !== undefined) updates.notifyWeeklyPicks = settings.weeklyPicks;

            await updateDoc(userRef, updates);
            return true;
        } catch (error) {
            console.error('[NotificationService] Update settings error:', error);
            return false;
        }
    }
};
