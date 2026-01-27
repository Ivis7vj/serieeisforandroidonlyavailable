import { supabase } from './supabase';
import { db } from './firebase';
import { doc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { logActivity } from './activity-logger';

import { tmdbApi } from './tmdb';
import { handleServiceError } from '@/utils/network-event';
import { checkCompletion, checkEpisodeProgress } from './completion-service';

export const getWatchedEpisodes = async (userId: string, tmdbId: number) => {
    if (!userId || !tmdbId) return [];
    try {
        // Read from Supabase
        const { data, error } = await supabase
            .from('watched_episodes')
            .select('season_number, episode_number')
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId);

        if (error) throw error;

        if (data && data.length > 0) {
            return data.map(item => ({
                season: item.season_number,
                episode: item.episode_number
            }));
        }

        // Fallback to Firebase (simplified for native)
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const watchedArray = userData.watched || [];
            const prefix = `${tmdbId}-S`;
            return watchedArray.filter((item: any) => {
                const idStr = String(typeof item === 'string' ? item : (item.id || ''));
                return idStr.startsWith(prefix);
            }).map((item: any) => {
                const idStr = String(typeof item === 'string' ? item : (item.id || ''));
                const parts = idStr.split('-');
                if (parts.length >= 3) {
                    const s = parseInt(parts[1].substring(1));
                    const e = parseInt(parts[2].substring(1));
                    return { season: s, episode: e };
                }
                return null;
            }).filter((item: any) => item !== null);
        }
        return [];
    } catch (error) {
        handleServiceError(error, 'WatchedService');
        return [];
    }
};

export const markEpisodeWatched = async (userId: string, tmdbId: number, seasonNumber: number, episodeNumber: number) => {
    try {
        const { error } = await supabase
            .from('watched_episodes')
            .upsert({
                user_id: userId,
                tmdb_id: tmdbId,
                season_number: seasonNumber,
                episode_number: episodeNumber,
                watched_at: new Date().toISOString()
            }, { onConflict: 'user_id,tmdb_id,season_number,episode_number' });

        if (error) throw error;

        // Log Activity
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        const series = await tmdbApi.getSeriesDetails(tmdbId);

        await logActivity(
            { uid: userId, username: userData?.username, photoURL: userData?.photoURL },
            'watched_episode',
            {
                seriesId: tmdbId,
                seriesName: series.name,
                posterPath: series.poster_path,
                seasonNumber: seasonNumber,
                episodeNumber: episodeNumber
            }
        );

        // Completion Check Hook
        await checkCompletion(userId, tmdbId);
        await checkEpisodeProgress(userId, tmdbId, seasonNumber);

        return true;
    } catch (error) {
        handleServiceError(error, 'WatchedService');
        return false;
    }
};

export const unmarkEpisodeWatched = async (userId: string, tmdbId: number, seasonNumber: number, episodeNumber: number) => {
    try {
        const { error } = await supabase
            .from('watched_episodes')
            .delete()
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber)
            .eq('episode_number', episodeNumber);

        if (error) throw error;

        // Remove Activity from Firestore
        const activityQ = query(
            collection(db, 'user_activity'),
            where('userId', '==', userId),
            where('type', '==', 'watched_episode'),
            where('tmdbId', '==', tmdbId),
            where('seasonNumber', '==', seasonNumber),
            where('episodeNumber', '==', episodeNumber)
        );
        const snap = await getDocs(activityQ);
        const batch = writeBatch(db);
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        return true;
    } catch (error) {
        handleServiceError(error, 'WatchedService');
        return false;
    }
};

export const getAllWatched = async (userId: string) => {
    if (!userId) return [];
    try {
        const { data, error } = await supabase
            .from('watched_episodes')
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;
        return data || [];
    } catch (error) {
        handleServiceError(error, 'WatchedService');
        return [];
    }
};

export const markSeasonWatched = async (userId: string, tmdbId: number, seasonNumber: number, episodeCount: number) => {
    try {
        const episodes = Array.from({ length: episodeCount }, (_, i) => ({
            user_id: userId,
            tmdb_id: tmdbId,
            season_number: seasonNumber,
            episode_number: i + 1,
            watched_at: new Date().toISOString()
        }));

        const { error } = await supabase
            .from('watched_episodes')
            .upsert(episodes, { onConflict: 'user_id,tmdb_id,season_number,episode_number' });

        if (error) {
            handleServiceError(error, 'WatchedService');
            throw error;
        }

        // Log Activity
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        const series = await tmdbApi.getSeriesDetails(tmdbId);

        await logActivity(
            { uid: userId, username: userData?.username, photoURL: userData?.photoURL },
            'watched_season',
            {
                seriesId: tmdbId,
                seriesName: series.name,
                posterPath: series.poster_path,
                seasonNumber: seasonNumber
            }
        );

        // Completion Check Hook
        await checkCompletion(userId, tmdbId);
        await checkEpisodeProgress(userId, tmdbId, seasonNumber);

        console.log(`[WatchedService] Successfully marked ${episodes.length} episodes as watched`);
        return true;
    } catch (error) {
        handleServiceError(error, 'WatchedService');
        return false;
    }
};

export const unmarkSeasonWatched = async (userId: string, tmdbId: number, seasonNumber: number) => {
    try {
        const { error } = await supabase
            .from('watched_episodes')
            .delete()
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber);

        if (error) throw error;

        // Remove Activity from Firestore
        const activityQ = query(
            collection(db, 'user_activity'),
            where('userId', '==', userId),
            where('type', '==', 'watched_season'),
            where('tmdbId', '==', tmdbId),
            where('seasonNumber', '==', seasonNumber)
        );
        const snap = await getDocs(activityQ);
        const batch = writeBatch(db);
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        return true;
    } catch (error) {
        handleServiceError(error, 'WatchedService');
        return false;
    }
};
export const getLatestWatchedSeriesId = async (userId: string) => {
    if (!userId) return null;
    try {
        // Fetch most recent item from ALL 5 interaction tables
        const [watched, sReviews, eReviews, sRatings, eRatings] = await Promise.all([
            // 1. Watched Episodes
            supabase.from('watched_episodes').select('tmdb_id, watched_at').eq('user_id', userId).order('watched_at', { ascending: false }).limit(1),
            // 2. Season Reviews
            supabase.from('season_reviews').select('tmdb_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
            // 3. Episode Reviews
            supabase.from('episode_reviews').select('tmdb_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
            // 4. Season Ratings
            supabase.from('season_ratings').select('tmdb_id, updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1),
            // 5. Episode Ratings
            supabase.from('episode_ratings').select('tmdb_id, updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1)
        ]);

        const candidates = [];

        if (watched.data?.[0]) candidates.push({ id: watched.data[0].tmdb_id, ts: new Date(watched.data[0].watched_at).getTime() });
        if (sReviews.data?.[0]) candidates.push({ id: sReviews.data[0].tmdb_id, ts: new Date(sReviews.data[0].created_at).getTime() });
        if (eReviews.data?.[0]) candidates.push({ id: eReviews.data[0].tmdb_id, ts: new Date(eReviews.data[0].created_at).getTime() });
        if (sRatings.data?.[0]) candidates.push({ id: sRatings.data[0].tmdb_id, ts: new Date(sRatings.data[0].updated_at).getTime() });
        if (eRatings.data?.[0]) candidates.push({ id: eRatings.data[0].tmdb_id, ts: new Date(eRatings.data[0].updated_at).getTime() });

        // 6. Fallback to Firebase Watched (Legacy)
        // Only if we found nothing in Supabase
        if (candidates.length === 0) {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                const watchedArray = userData.watched || [];
                if (watchedArray.length > 0) {
                    const lastItem = watchedArray[watchedArray.length - 1];
                    const idStr = String(typeof lastItem === 'string' ? lastItem : (lastItem.id || ''));
                    const fbId = parseInt(idStr.split('-')[0]);
                    if (fbId) candidates.push({ id: fbId, ts: 0 }); // Low priority timestamp
                }
            }
        }

        if (candidates.length === 0) return null;

        // Sort by timestamp DESC (Newest First)
        candidates.sort((a, b) => b.ts - a.ts);

        const winner = candidates[0];
        console.log('[WatchedService] Latest Activity Winner:', winner.id, 'at', new Date(winner.ts).toISOString());

        return winner.id;

    } catch (error) {
        handleServiceError(error, 'WatchedService');
        return null;
    }
};
