import { supabase } from './supabase';
import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { banService } from './ban-service';

export const setEpisodeRating = async (userId: string, tmdbId: number, seasonNumber: number, episodeNumber: number, rating: number) => {
    try {
        const { isRestricted } = await banService.checkActionRestriction(userId, 'RATE');
        if (isRestricted) return false;

        const { error } = await supabase
            .from('episode_ratings')
            .upsert({
                user_id: userId,
                tmdb_id: tmdbId,
                season_number: seasonNumber,
                episode_number: episodeNumber,
                rating: rating,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,tmdb_id,season_number,episode_number' });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('[RatingService] Set Episode Rating Error:', error);
        return false;
    }
};

export const setSeasonRating = async (userId: string, tmdbId: number, seasonNumber: number, rating: number) => {
    try {
        const { isRestricted } = await banService.checkActionRestriction(userId, 'RATE');
        if (isRestricted) return false;

        const { error } = await supabase
            .from('season_ratings')
            .upsert({
                user_id: userId,
                tmdb_id: tmdbId,
                season_number: seasonNumber,
                rating: rating,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,tmdb_id,season_number' });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('[RatingService] Set Season Rating Error:', error);
        return false;
    }
};

export const getEpisodeRating = async (userId: string, tmdbId: number, seasonNumber: number, episodeNumber: number) => {
    try {
        const { data, error } = await supabase
            .from('episode_ratings')
            .select('rating')
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber)
            .eq('episode_number', episodeNumber)
            .maybeSingle();

        if (error) throw error;
        return data ? data.rating : null;
    } catch (error) {
        console.error('[RatingService] Get Episode Rating Error:', error);
        return null;
    }
};

export const deleteEpisodeRating = async (userId: string, tmdbId: number, seasonNumber: number, episodeNumber: number) => {
    try {
        const { error } = await supabase
            .from('episode_ratings')
            .delete()
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber)
            .eq('episode_number', episodeNumber);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('[RatingService] Delete Episode Rating Error:', error);
        return false;
    }
};

export const deleteSeasonRating = async (userId: string, tmdbId: number, seasonNumber: number) => {
    try {
        const { error } = await supabase
            .from('season_ratings')
            .delete()
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('[RatingService] Delete Season Rating Error:', error);
        return false;
    }
};

/**
 * Get all ratings by a specific user (for profile page)
 */
export const getUserRatings = async (userId: string) => {
    try {
        const [episodeRatings, seasonRatings] = await Promise.all([
            supabase
                .from('episode_ratings')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false }),
            supabase
                .from('season_ratings')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false })
        ]);

        const supabaseResults = {
            episodes: episodeRatings.data || [],
            seasons: seasonRatings.data || []
        };

        // FIREBASE FALLBACK
        const q = query(
            collection(db, 'ratings'), // assuming 'ratings' collection exists for legacy
            where('userId', '==', userId)
        );
        const fbSnap = await getDocs(q);
        fbSnap.forEach(doc => {
            const data = doc.data();
            if (data.isEpisode) {
                supabaseResults.episodes.push({ ...data, id: doc.id, source: 'firebase' });
            } else {
                supabaseResults.seasons.push({ ...data, id: doc.id, source: 'firebase' });
            }
        });

        return supabaseResults;
    } catch (error) {
        console.error('[RatingService] Fetch User Ratings Error:', error);
        return { episodes: [], seasons: [] };
    }
};
