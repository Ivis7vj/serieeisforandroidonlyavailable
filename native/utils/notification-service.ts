import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import { db } from './firebase';
import { doc, updateDoc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { supabase } from './supabase';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as AsyncStorage from '@react-native-async-storage/async-storage';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: false, // Suppress system alert in foreground (we use custom toast)
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const NOTIFICATION_TASK_NAME = 'BACKGROUND_NOTIFICATION_TASK';

// Define the background task at the top level
TaskManager.defineTask(NOTIFICATION_TASK_NAME, async () => {
    try {
        console.log('[BackgroundFetch] Running background notification check...');
        const userId = await AsyncStorage.default.getItem('auth_uid');
        if (!userId) {
            console.log('[BackgroundFetch] No user ID found in storage. Skipping.');
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        await notificationService.checkNewEpisodes(userId);
        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        console.error('[BackgroundFetch] Task failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
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
                const userRef = doc(db, 'users', userId);
                const userSnap = await getDoc(userRef);
                const currentToken = userSnap.exists() ? userSnap.data().pushToken : null;

                if (currentToken !== token) {
                    console.log('[NotificationService] Saving NEW token to Firestore users/' + userId);
                    await updateDoc(userRef, {
                        pushToken: token,
                        notificationsEnabled: true,
                        lastTokenUpdate: new Date().toISOString()
                    });
                    console.log('[NotificationService] Firestore update complete');
                } else {
                    console.log('[NotificationService] Token already current in Firestore');
                }
            }

            return token;
        } catch (error: any) {
            console.error('[NotificationService] Error getting token:', error.message);
            Alert.alert('Push Registration Error', error.message);
            return null;
        }
    },

    /**
     * Remove push token from backend on logout
     */
    removePushToken: async (userId: string) => {
        try {
            console.log('[NotificationService] Removing push token for user', userId);
            const userRef = doc(db, 'users', userId);
            // We set it to null or remove the field. 
            // Using updateDoc with just the field null is easiest.
            await updateDoc(userRef, {
                pushToken: null,
                lastTokenUpdate: new Date().toISOString()
            });
        } catch (error) {
            console.warn('[NotificationService] Failed to remove token:', error);
            // Don't block logout
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
    },

    /**
     * Aggregates all series IDs that the user has interacted with (Watchlist, Liked, Rated, Watched)
     */
    getInteractedSeriesIds: async (userId: string): Promise<Set<number>> => {
        try {
            const seriesIds = new Set<number>();

            // 1. Fetch from Supabase Tables
            const [watchlist, likes, watched, sRatings, eRatings] = await Promise.all([
                supabase.from('watchlist').select('tmdb_id').eq('user_id', userId),
                supabase.from('likes').select('tmdb_id').eq('user_id', userId),
                supabase.from('watched_episodes').select('tmdb_id').eq('user_id', userId),
                supabase.from('season_ratings').select('tmdb_id').eq('user_id', userId),
                supabase.from('episode_ratings').select('tmdb_id').eq('user_id', userId),
            ]);

            watchlist.data?.forEach(row => seriesIds.add(row.tmdb_id));
            likes.data?.forEach(row => seriesIds.add(row.tmdb_id));
            watched.data?.forEach(row => seriesIds.add(row.tmdb_id));
            sRatings.data?.forEach(row => seriesIds.add(row.tmdb_id));
            eRatings.data?.forEach(row => seriesIds.add(row.tmdb_id));

            // 2. Fetch Shared Series from Firestore Activity
            const q = query(
                collection(db, 'user_activity'),
                where('userId', '==', userId),
                where('category', 'in', ['WATCHED', 'REVIEWED', 'LIKED']) // Broad categories
            );
            const fbSnap = await getDocs(q);
            fbSnap.forEach(doc => {
                const data = doc.data();
                if (data.tmdbId) seriesIds.add(Number(data.tmdbId));
            });

            return seriesIds;
        } catch (error) {
            console.error('[NotificationService] Error aggregating series IDs:', error);
            return new Set();
        }
    },

    /**
     * Send a local push notification
     */
    sendLocalNotification: async (title: string, body: string, data: any = {}) => {
        await Notifications.scheduleNotificationAsync({
            content: { title, body, data },
            trigger: null, // send immediately
        });
    },

    /**
     * Check for new episodes or seasons for all interacted series
     */
    checkNewEpisodes: async (userId: string) => {
        try {
            // 1. Get ALL interacted IDs
            const subscribedIds = await notificationService.getInteractedSeriesIds(userId);
            if (subscribedIds.size === 0) return null;

            // 2. Fetch "Airing Today" from TMDB
            const { tmdbApi } = require('./tmdb');
            const [airingToday, onTheAir] = await Promise.all([
                tmdbApi.getNewReleases(), // Airing Today
                tmdbApi.getHeroEpisodes()  // On The Air (Future/Recent)
            ]);

            const allEvents = [...airingToday, ...onTheAir];
            const uniqueMatches = Array.from(new Set(allEvents.filter((show: any) => subscribedIds.has(show.id)).map(s => s.id)));

            for (const id of uniqueMatches) {
                const details = await tmdbApi.getSeriesDetails(id);
                const nextEp = details.next_episode_to_air;

                if (nextEp) {
                    const isToday = new Date(nextEp.air_date).toDateString() === new Date().toDateString();
                    if (isToday) {
                        const isNewSeason = nextEp.episode_number === 1;
                        const title = isNewSeason ? `New Season: ${details.name}!` : `New Episode: ${details.name}`;
                        const body = isNewSeason
                            ? `Season ${nextEp.season_number} starts today with "${nextEp.name}"!`
                            : `S${nextEp.season_number}E${nextEp.episode_number} "${nextEp.name}" is out now!`;

                        await notificationService.sendLocalNotification(title, body, {
                            route: `/series/${id}`,
                            season: nextEp.season_number,
                            episode: nextEp.episode_number
                        });
                        console.log(`[NotificationService] Notification triggered for ${details.name}`);
                    }
                }
            }
        } catch (err) {
            console.error("[NotificationService] Check Episodes Error", err);
        }
    },

    /**
     * Registers the background fetch task
     */
    registerBackgroundFetch: async () => {
        try {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(NOTIFICATION_TASK_NAME);
            if (!isRegistered) {
                console.log('[NotificationService] Registering background fetch task...');
                await BackgroundFetch.registerTaskAsync(NOTIFICATION_TASK_NAME, {
                    minimumInterval: 60 * 60, // Check every hour (OS will throttle this)
                    stopOnTerminate: false,   // 🛡️ CRITICAL: Keep running after app-kill
                    startOnBoot: true,        // 🛡️ CRITICAL: Start after phone restart
                });
            }
        } catch (err) {
            console.error('[NotificationService] Background registration failed:', err);
        }
    }
};
