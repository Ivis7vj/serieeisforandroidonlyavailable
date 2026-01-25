import { supabase } from './supabase';
import { db } from './firebase';
import { doc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';

import { logActivity } from './activity-logger';
import { handleServiceError } from '@/utils/network-event';

export const getWatchlist = async (userId: string) => {
    if (!userId) return [];

    try {
        // 1. Fetch from Supabase
        const { data: sbData, error: sbError } = await supabase
            .from('watchlist')
            .select('*')
            .eq('user_id', userId)
            .order('added_at', { ascending: false });

        if (sbError) throw sbError;

        if (sbData && sbData.length > 0) {
            return sbData.map(item => ({
                id: item.tmdb_id, // For UI compatibility
                tmdb_id: Number(item.tmdb_id),
                seriesId: Number(item.series_id),
                name: item.name,
                poster_path: item.poster_path,
                still_path: item.still_path,
                vote_average: item.vote_average,
                first_air_date: item.first_air_date,
                isSeason: item.item_type === 'season',
                isEpisode: item.item_type === 'episode',
                seasonNumber: item.season_number,
                episodeNumber: item.episode_number,
                date: item.added_at
            }));
        }

        // 2. Fallback: Read from Firebase
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const fbWatchlist = userData.watchlist || [];

            // Simplified mapping for native
            return fbWatchlist.map((item: any) => ({
                ...item,
                tmdb_id: item.id || item.tmdb_id
            }));
        }

        return [];
    } catch (error) {
        handleServiceError(error, 'WatchlistService');
        return [];
    }
};

export const addToWatchlist = async (userId: string, item: any | any[]) => {
    if (!userId || !item) return false;

    const items = Array.isArray(item) ? item : [item];

    const rows = items.map(i => ({
        user_id: userId,
        tmdb_id: i.id || i.tmdbId,
        item_type: i.type || (i.isEpisode ? 'episode' : (i.isSeason ? 'season' : 'series')),
        series_id: i.seriesId || (i.type === 'series' ? i.id : null),
        name: i.name,
        poster_path: i.poster_path,

        still_path: i.still_path,
        vote_average: i.vote_average,
        first_air_date: i.first_air_date,
        season_number: i.seasonNumber,
        episode_number: i.episodeNumber,
        added_at: new Date().toISOString()
    }));

    try {
        const { error } = await supabase
            .from('watchlist')
            .upsert(rows, { onConflict: 'user_id,tmdb_id' });

        if (error) throw error;

        // Log Activity
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        for (const item of items) {
            await logActivity(
                { uid: userId, username: userData?.username, photoURL: userData?.photoURL },
                'watchlist_add',
                {
                    seriesId: item.id || item.tmdbId,
                    seriesName: item.name,
                    posterPath: item.poster_path,
                    seasonNumber: item.seasonNumber,
                    episodeNumber: item.episodeNumber
                }
            );
        }

        return true;
    } catch (error) {
        handleServiceError(error, 'WatchlistService');
        return false;
    }
};

export const removeFromWatchlist = async (userId: string, tmdbId: number) => {
    if (!userId || !tmdbId) return false;

    try {
        const { error } = await supabase
            .from('watchlist')
            .delete()
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId);

        if (error) throw error;

        // Remove Activity from Firestore
        const activityQ = query(
            collection(db, 'user_activity'),
            where('userId', '==', userId),
            where('type', '==', 'watchlist_add'),
            where('tmdbId', '==', tmdbId)
        );
        const snap = await getDocs(activityQ);
        const batch = writeBatch(db);
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        return true;
    } catch (error) {
        handleServiceError(error, 'WatchlistService');
        return false;
    }
};

export const removeFromWatchlistBulk = async (userId: string, tmdbIds: number[]) => {
    if (!userId || !tmdbIds || tmdbIds.length === 0) return false;

    try {
        const { error } = await supabase
            .from('watchlist')
            .delete()
            .eq('user_id', userId)
            .in('tmdb_id', tmdbIds);

        if (error) throw error;
        return true;
    } catch (error) {
        handleServiceError(error, 'WatchlistService');
        return false;
    }
};

export const removeSeasonFromWatchlist = async (userId: string, seriesId: number, seasonNumber: number) => {
    if (!userId || !seriesId) return false;

    try {
        const { error } = await supabase
            .from('watchlist')
            .delete()
            .eq('user_id', userId)
            .eq('series_id', seriesId)
            .eq('season_number', seasonNumber);

        if (error) throw error;
        return true;
    } catch (error) {
        handleServiceError(error, 'WatchlistService');
        return false;
    }
};

export const isInWatchlist = async (userId: string, tmdbId: number) => {
    if (!userId || !tmdbId) return false;

    try {
        const { data, error } = await supabase
            .from('watchlist')
            .select('tmdb_id')
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .maybeSingle();

        if (error) throw error;
        return !!data;
    } catch (error) {
        // Fallback check in Firebase if not in Supabase? 
        // For now, let's assume Supabase is SSOT for active usage.
        handleServiceError(error, 'WatchlistService');
        return false;
    }
};
