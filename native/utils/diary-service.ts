import { supabase } from './supabase';
import * as reviewService from './review-service';
import { db } from './firebase';
import { getDoc, doc } from 'firebase/firestore';

/**
 * 🎯 DIARY SYSTEM v2 (Strict Logic)
 * 
 * A Diary entry is ONLY created if:
 * 1. Season is WATCHED
 * 2. Season is RATED
 * 3. Season is REVIEWED (Text required)
 */

const normalizeDiaryEntry = (entry: any) => {
    // STRICT DATE HANDLING: 
    // We treat dates as pure YYYY-MM-DD strings to prevent "Day Offset" issues 
    // caused by local timezone shifts on ISO strings.
    let rawDate = entry.watched_at || entry.created_at || new Date().toISOString();

    // If it's a full ISO string, extract just the date part for display stability
    const date = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;

    // Determine source table for precise updates later
    let sourceTable = 'diary_entries';
    if (entry.entry_type === 'EPISODE_DIARY_v2' || !!entry.episode_number) {
        sourceTable = 'episode_reviews';
    } else if (entry.entry_type !== 'SEASON_DIARY_v2' && !entry.watched_at) {
        sourceTable = 'season_reviews';
    }

    return {
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
        date: date, // Normalized YYYY-MM-DD
        createdAt: entry.created_at || rawDate,
        isEpisode: sourceTable === 'episode_reviews',
        isSeason: sourceTable !== 'episode_reviews',
        sourceTable
    };
};

export const createDiaryEntry = async (userId: string, seriesData: any, seasonNumber: number, reviewData: any, watchedDate = new Date().toISOString()) => {
    if (!reviewData.rating) {
        return { success: false, error: "Rating is required for Diary." };
    }

    try {
        // INTELLIGENT ROUTING: 
        // If it's an episode, use episode_reviews table (which has the column)
        if (reviewData.episodeNumber !== undefined && reviewData.episodeNumber !== null) {
            // Fetch user info for mandatory fields in reviews table
            const userSnap = await getDoc(doc(db, 'users', userId));
            const userData = userSnap.data();

            await reviewService.createEpisodeReview(
                userId,
                seriesData.id,
                Number(seasonNumber),
                Number(reviewData.episodeNumber),
                reviewData.review || "",
                Number(reviewData.rating),
                userData?.username || 'User',
                userData?.photoURL || '',
                seriesData.name,
                reviewData.poster_path || seriesData.poster_path
            );
            return { success: true };
        }

        // Otherwise use diary_entries (Season level)
        const payload = {
            user_id: userId,
            tmdb_id: seriesData.id,
            series_name: seriesData.name,
            season_number: Number(seasonNumber),
            poster_path: reviewData.poster_path || seriesData.poster_path,
            rating: reviewData.rating,
            review_text: reviewData.review || "",
            watched_at: watchedDate,
            entry_type: 'SEASON_DIARY_v2'
        };

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

export const updateDiaryEntry = async (entry: any, updates: any) => {
    const table = entry.sourceTable || (entry.episodeNumber ? 'episode_reviews' : 'diary_entries');

    try {
        // 1. Update the PRIMARY source of this entry
        const { data: updatedRecord, error: updateError } = await supabase
            .from(table)
            .update({
                rating: updates.rating,
                review_text: updates.review,
                [table === 'diary_entries' ? 'watched_at' : 'created_at']: updates.date,
                updated_at: new Date().toISOString()
            })
            .eq('id', entry.id)
            .select()
            .maybeSingle(); // FIX: Prevent PGRST116 if record missing

        if (updateError) throw updateError;
        if (!updatedRecord) return { success: false, error: "Record not found" };

        // 2. Cross-table Sync for Seasons
        if (table === 'diary_entries') {
            // Also sync season_reviews (Fire and forget)
            supabase.from('season_reviews').update({
                rating: updates.rating,
                review_text: updates.review,
                created_at: updates.date,
                updated_at: new Date().toISOString()
            }).eq('user_id', entry.userId).eq('tmdb_id', entry.tmdbId).eq('season_number', entry.seasonNumber).then();
        } else if (table === 'season_reviews') {
            // Also sync diary_entries (Fire and forget)
            supabase.from('diary_entries').update({
                rating: updates.rating,
                review_text: updates.review,
                watched_at: updates.date,
                updated_at: new Date().toISOString()
            }).eq('user_id', entry.userId).eq('tmdb_id', entry.tmdbId).eq('season_number', entry.seasonNumber).then();
        }

        return { success: true, data: normalizeDiaryEntry(updatedRecord) };
    } catch (e) {
        console.error("[DiaryService] Update failed:", e);
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
        // COMPOSITE FETCH: Pull from Diary table + Reviews tables
        const [diaryRes, epReviews, sReviews] = await Promise.all([
            supabase.from('diary_entries').select('*').eq('user_id', userId),
            supabase.from('episode_reviews').select('*').eq('user_id', userId),
            supabase.from('season_reviews').select('*').eq('user_id', userId)
        ]);

        const diaryEntries = (diaryRes.data || []).map(normalizeDiaryEntry);
        const epEntries = (epReviews.data || []).map(r => normalizeDiaryEntry({ ...r, entry_type: 'EPISODE_DIARY_v2' }));
        const sEntries = (sReviews.data || []).map(r => normalizeDiaryEntry(r));

        // Merge with strict priority: diary_entries > episode_reviews > season_reviews
        // We ensure diaryEntries are processed first in the case of same-date matches
        const merged = [...diaryEntries, ...epEntries, ...sEntries];
        const seen = new Set();
        const unique = [];

        // Sort by date descending first (Latest wins)
        merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        for (const item of merged) {
            const anyItem = item as any;
            // Key handles show-season-episode distinction
            const key = `${anyItem.tmdbId}-${anyItem.seasonNumber}-${anyItem.episodeNumber || 0}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(item);
            }
        }

        return unique.filter(item => {
            if (item.seasonNumber === undefined || item.seasonNumber === null) return false;
            // if (!item.rating) return false; // STRICT FIX: Allow scraped reviews without ratings
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
