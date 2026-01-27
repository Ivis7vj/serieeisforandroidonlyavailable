import { supabase } from './supabase';
import { db } from './firebase';
import { doc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { logActivity } from './activity-logger';
import { tmdbApi } from './tmdb';

const TABLE = 'likes';

export interface LikeItem {
    id: string; // Composite ID
    seriesId: number;
    tmdbId: number;
    type: 'SERIES' | 'SEASON' | 'EPISODE';
    seasonNumber: number | null;
    episodeNumber: number | null;
    source: string;
    poster_path?: string;
}

const parseTmdbId = (id: any): number | null => {
    if (!id) return null;
    if (typeof id === 'number') return id;
    if (typeof id === 'string' && id.includes('-S')) {
        const numeric = parseInt(id.split('-S')[0]);
        return isNaN(numeric) ? null : numeric;
    }
    const numeric = parseInt(id);
    if (isNaN(numeric) || (typeof id === 'string' && id.match(/[a-z]/i) && !id.includes('-S'))) return null;
    return numeric;
};

export const getUserLikes = async (userId: string): Promise<LikeItem[]> => {
    try {
        // 1. Try Supabase
        const { data: sbData, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;

        if (sbData && sbData.length > 0) {
            const uniqueLikesMap = new Map<string, LikeItem>();

            sbData.forEach(row => {
                const isSeason = row.item_type === 'SEASON';
                const isEpisode = row.item_type === 'EPISODE';

                let compositeId = String(row.tmdb_id);
                if (isSeason) compositeId += `-S${row.season_number}`;
                if (isEpisode) compositeId += `-S${row.season_number}E${row.episode_number}`;

                // Only keep one entry per unique item (latest takes precedence)
                uniqueLikesMap.set(compositeId, {
                    id: compositeId,
                    seriesId: row.tmdb_id,
                    tmdbId: row.tmdb_id,
                    type: row.item_type,
                    seasonNumber: row.season_number,
                    episodeNumber: row.episode_number,
                    source: 'supabase'
                });
            });

            return Array.from(uniqueLikesMap.values());
        }

        // 2. Fallback to Firebase
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            const fbLikes = userData.likes || [];

            // Filter out non-media likes
            const mediaLikes = fbLikes.filter((l: any) => !l.type || ['series', 'season', 'episode'].includes(l.type) || !l.item_type);

            const uniqueLikesMap = new Map<string, LikeItem>();

            mediaLikes.forEach((l: any) => {
                const lId = parseTmdbId(l.seriesId || l.id);
                if (!lId) return;

                const isSeason = l.type === 'season' || (l.seasonNumber && !l.episodeNumber);
                const isEpisode = l.type === 'episode' || (l.seasonNumber && l.episodeNumber);

                let compositeId = String(lId);
                if (isSeason) compositeId += `-S${l.seasonNumber}`;
                if (isEpisode) compositeId += `-S${l.seasonNumber}E${l.episodeNumber}`;

                uniqueLikesMap.set(compositeId, {
                    id: compositeId,
                    seriesId: lId,
                    tmdbId: lId,
                    type: isEpisode ? 'EPISODE' : (isSeason ? 'SEASON' : 'SERIES'),
                    seasonNumber: l.seasonNumber || null,
                    episodeNumber: l.episodeNumber || null,
                    source: 'firebase_legacy'
                });
            });

            return Array.from(uniqueLikesMap.values());
        }

        return [];
    } catch (err) {
        console.error("Error fetching likes:", err);
        return [];
    }
};

export const isLiked = async (userId: string, tmdbId: number, type: 'SERIES' | 'SEASON' | 'EPISODE' = 'SERIES', seasonNum: number | null = null, episodeNum: number | null = null) => {
    try {
        let query = supabase
            .from(TABLE)
            .select('id')
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('item_type', type);

        if (seasonNum !== null) query = query.eq('season_number', seasonNum);
        if (episodeNum !== null) query = query.eq('episode_number', episodeNum);

        const { data, error } = await query.maybeSingle();

        if (data) return true;

        const { count } = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('user_id', userId);
        if (count && count > 0) return false;

        // Firebase Fallback
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const list = userSnap.data().likes || [];
            return list.some((l: any) => {
                const lId = l.seriesId || l.id;
                const lSeason = l.seasonNumber;
                const lEpisode = l.episodeNumber;

                if (String(lId) !== String(tmdbId)) return false;

                if (type === 'EPISODE') return String(lSeason) === String(seasonNum) && String(lEpisode) === String(episodeNum);
                if (type === 'SEASON') return String(lSeason) === String(seasonNum) && !lEpisode;
                return !lSeason && !lEpisode;
            });
        }
        return false;
    } catch (e) {
        console.error("isLiked check failed", e);
        return false;
    }
};

export const likeSeason = async (userId: string, tmdbId: number, seasonNumber: number) => {
    try {
        // Fetch User Profile for Logging
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        // Fetch Series Details for Name/Poster
        const series = await tmdbApi.getSeriesDetails(tmdbId);

        // Check existence first to avoid ON CONFLICT error
        const { data: existing } = await supabase
            .from(TABLE)
            .select('id')
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('item_type', 'SEASON')
            .eq('season_number', seasonNumber)
            .maybeSingle();

        if (existing) return true;

        const { error } = await supabase
            .from(TABLE)
            .insert({
                user_id: userId,
                tmdb_id: tmdbId,
                series_id: tmdbId, // FIX: Trigger expects this field
                item_type: 'SEASON',
                season_number: seasonNumber,
                created_at: new Date().toISOString()
            });

        if (error) throw error;

        // Log Activity
        await logActivity(
            { uid: userId, username: userData?.username, photoURL: userData?.photoURL },
            'liked_season',
            {
                seriesId: tmdbId,
                seriesName: series.name,
                posterPath: series.poster_path,
                seasonNumber: seasonNumber
            }
        );

        return true;
    } catch (e) {
        console.error("likeSeason failed", e);
        return false;
    }
};

export const unlikeSeason = async (userId: string, tmdbId: number, seasonNumber: number) => {
    try {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('item_type', 'SEASON')
            .eq('season_number', seasonNumber);

        if (error) throw error;

        // Remove Activity from Firestore
        const activityQ = query(
            collection(db, 'user_activity'),
            where('userId', '==', userId),
            where('type', '==', 'liked_season'),
            where('tmdbId', '==', tmdbId),
            where('seasonNumber', '==', seasonNumber)
        );
        const snap = await getDocs(activityQ);
        const batch = writeBatch(db);
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        return true;
    } catch (e) {
        console.error("unlikeSeason failed", e);
        return false;
    }
};
