import { supabase } from './supabase';

/**
 * 🎯 DIARY SYSTEM v2 (Strict Logic)
 * 
 * A Diary entry is ONLY created if:
 * 1. Season is WATCHED
 * 2. Season is RATED
 * 3. Season is REVIEWED (Text required)
 */

const normalizeDiaryEntry = (entry: any) => ({
    id: entry.id,
    userId: entry.user_id,
    tmdbId: entry.tmdb_id,
    seriesName: entry.series_name,
    name: entry.series_name,
    seasonNumber: entry.season_number,
    episodeNumber: entry.episode_number,
    posterPath: entry.poster_path,
    rating: entry.rating,
    review: entry.review_text || "",
    date: entry.watched_at,
    createdAt: entry.created_at,
    isSeason: true
});

export const createDiaryEntry = async (userId: string, seriesData: any, seasonNumber: number, reviewData: any, watchedDate = new Date().toISOString()) => {
    if (!reviewData.rating || !reviewData.review) {
        return { success: false, error: "Review and Rating are required for Diary." };
    }

    const payload = {
        user_id: userId,
        tmdb_id: seriesData.id,
        series_name: seriesData.name,
        season_number: Number(seasonNumber),
        poster_path: reviewData.poster_path || seriesData.poster_path,
        rating: reviewData.rating,
        review_text: reviewData.review,
        watched_at: watchedDate,
        entry_type: 'SEASON_DIARY_v2'
    };

    try {
        const { data, error } = await supabase
            .from('diary_entries')
            .upsert(payload, { onConflict: 'user_id,tmdb_id,season_number' })
            .select()
            .single();

        if (error) throw error;
        return { success: true, data: normalizeDiaryEntry(data) };
    } catch (error) {
        console.error("Diary Creation Failed:", error);
        return { success: false, error };
    }
};

export const updateDiaryEntry = async (entryId: string, updates: any) => {
    const payload: any = {};
    if (updates.rating) payload.rating = updates.rating;
    if (updates.review) payload.review_text = updates.review;
    if (updates.date) payload.watched_at = updates.date;

    try {
        const { data, error } = await supabase
            .from('diary_entries')
            .update(payload)
            .eq('id', entryId)
            .select()
            .single();

        if (error) throw error;
        return { success: true, data: normalizeDiaryEntry(data) };
    } catch (e) {
        return { success: false, error: e };
    }
};

export const deleteDiaryEntry = async (entryId: string) => {
    try {
        const { error } = await supabase
            .from('diary_entries')
            .delete()
            .eq('id', entryId);

        if (error) throw error;
        return { success: true };
    } catch (e) {
        return { success: false, error: e };
    }
}


export const deleteSeasonDiaryEntry = async (userId: string, tmdbId: number, seasonNumber: number) => {
    try {
        const { error } = await supabase
            .from('diary_entries')
            .delete()
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber);

        if (error) throw error;
        return { success: true };
    } catch (e) {
        return { success: false, error: e };
    }
};

export const getUserDiary = async (userId: string) => {
    try {
        const { data, error } = await supabase
            .from('diary_entries')
            .select('*')
            .eq('user_id', userId)
            .order('watched_at', { ascending: false });

        if (error) throw error;

        return (data || []).map(normalizeDiaryEntry).filter(item => {
            if (!item.seasonNumber && item.seasonNumber !== 0) return false;
            if (!item.rating) return false;
            if (!item.review || item.review.trim() === "") return false;
            return true;
        });
    } catch (error) {
        console.error("Error fetching diary:", error);
        return [];
    }
};

export const getDiaryEntryById = async (entryId: string) => {
    try {
        const { data, error } = await supabase
            .from('diary_entries')
            .select('*')
            .eq('id', entryId)
            .single();

        if (error) throw error;
        return normalizeDiaryEntry(data);
    } catch (e) {
        console.error("Error fetching diary entry:", e);
        return null;
    }
};

export const getSeasonDiaryEntry = async (userId: string, tmdbId: number, seasonNumber: number) => {
    try {
        const { data, error } = await supabase
            .from('diary_entries')
            .select('*')
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        const entry = normalizeDiaryEntry(data);
        if (!entry.rating || !entry.review) return null;

        return entry;
    } catch (e) {
        return null;
    }
};
