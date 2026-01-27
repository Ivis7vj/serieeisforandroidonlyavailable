import { supabase } from './supabase';
import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { banService } from './ban-service';

export const getEpisodeReviews = async (tmdbId: number, seasonNumber: number, episodeNumber: number) => {
    try {
        // Try Supabase first
        const { data: supabaseData, error } = await supabase
            .from('episode_reviews')
            .select('*')
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber)
            .eq('episode_number', episodeNumber)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (supabaseData && supabaseData.length > 0) {
            return supabaseData.map(review => ({
                ...review,
                id: review.id,
                userId: review.user_id,
                userName: review.user_name || 'User',
                photoURL: review.photo_url,
                tmdbId: review.tmdb_id,
                seriesId: review.series_id,
                seasonNumber: review.season_number,
                episodeNumber: review.episode_number,
                review: review.review_text,
                rating: review.rating?.toString(),
                createdAt: review.created_at || new Date().toISOString(),
                isEpisode: true,
                source: 'supabase'
            }));
        }

        // Fallback to Firebase
        const q = query(
            collection(db, 'reviews'),
            where('tmdbId', '==', tmdbId),
            where('seasonNumber', '==', seasonNumber),
            where('episodeNumber', '==', episodeNumber),
            where('isEpisode', '==', true)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
            source: 'firebase'
        }));
    } catch (error) {
        console.error('[ReviewService] Get Episode Error:', error);
        return [];
    }
};

export const getUserReviews = async (userId: string) => {
    try {
        const [
            epReviews,
            sReviews,
            diaryEntries,
            epRatings,
            sRatings
        ] = await Promise.all([
            supabase.from('episode_reviews').select('*').eq('user_id', userId),
            supabase.from('season_reviews').select('*').eq('user_id', userId),
            supabase.from('diary_entries').select('*').eq('user_id', userId),
            supabase.from('episode_ratings').select('*').eq('user_id', userId),
            supabase.from('season_ratings').select('*').eq('user_id', userId)
        ]);

        const mapped = [
            ...(epReviews.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seriesName: r.series_name || r.name || 'Show',
                name: r.series_name || r.name || 'Show',
                seasonNumber: r.season_number,
                episodeNumber: r.episode_number,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at || new Date().toISOString(),
                poster_path: r.poster_path,
                isEpisode: true,
                source: 'supabase_review'
            })),
            ...(sReviews.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seriesName: r.series_name || r.name || 'Show',
                name: r.series_name || r.name || 'Show',
                seasonNumber: r.season_number,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at || new Date().toISOString(),
                poster_path: r.poster_path,
                isSeason: true,
                source: 'supabase_review'
            })),
            ...(diaryEntries.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seriesName: r.series_name || r.name || 'Show',
                name: r.series_name || r.name || 'Show',
                seasonNumber: r.season_number,
                episodeNumber: r.episode_number,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.watched_at || r.created_at || new Date().toISOString(),
                poster_path: r.poster_path,
                isSeason: !r.episode_number,
                isEpisode: !!r.episode_number,
                source: 'supabase_diary'
            })),
            ...(epRatings.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seriesName: r.series_name || r.name,
                name: r.series_name || r.name,
                seasonNumber: r.season_number,
                episodeNumber: r.episode_number,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                rating: r.rating?.toString(),
                createdAt: r.created_at || r.updated_at || new Date().toISOString(),
                poster_path: r.poster_path,
                isEpisode: true,
                source: 'supabase_rating'
            })),
            ...(sRatings.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seriesName: r.series_name || r.name,
                name: r.series_name || r.name,
                seasonNumber: r.season_number,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                rating: r.rating?.toString(),
                createdAt: r.created_at || r.updated_at || new Date().toISOString(),
                poster_path: r.poster_path,
                isSeason: true,
                source: 'supabase_rating'
            }))
        ];

        // Deduplicate
        const seen = new Set();
        const unique = [];
        mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        for (const item of mapped) {
            const key = `${item.tmdbId}-${item.seasonNumber}-${item.episodeNumber || 0}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(item);
            }
        }

        // Add Firebase
        const q = query(collection(db, 'reviews'), where('userId', '==', userId));
        const fbSnap = await getDocs(q);
        const firebaseReviews = fbSnap.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                source: 'firebase',
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString()
            };
        });

        const all = [...unique, ...firebaseReviews];
        return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
        console.error('[ReviewService] Unified Get User Reviews Error:', error);
        return [];
    }
};

export const getSeriesReviews = async (tmdbId: number, knownSeriesName: string | null = null) => {
    try {
        const [
            epReviews,
            sReviews,
            diaryEntries,
            epRatings,
            sRatings
        ] = await Promise.all([
            supabase.from('episode_reviews').select('*').eq('tmdb_id', tmdbId),
            supabase.from('season_reviews').select('*').eq('tmdb_id', tmdbId),
            supabase.from('diary_entries').select('*').eq('tmdb_id', tmdbId),
            supabase.from('episode_ratings').select('*').eq('tmdb_id', tmdbId),
            supabase.from('season_ratings').select('*').eq('tmdb_id', tmdbId)
        ]);

        const mapped = [
            ...(epReviews.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seriesName: knownSeriesName || r.series_name || r.name || 'Show',
                name: knownSeriesName || r.series_name || r.name || 'Show',
                seasonNumber: r.season_number,
                episodeNumber: r.episode_number,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at || new Date().toISOString(),
                isEpisode: true,
                source: 'supabase_review'
            })),
            ...(sReviews.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seriesName: knownSeriesName || r.series_name || r.name || 'Show',
                name: knownSeriesName || r.series_name || r.name || 'Show',
                seasonNumber: r.season_number,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at || new Date().toISOString(),
                isSeason: true,
                source: 'supabase_review'
            })),
            ...(diaryEntries.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seriesName: knownSeriesName || r.series_name || r.name || 'Show',
                name: knownSeriesName || r.series_name || r.name || 'Show',
                seasonNumber: r.season_number,
                episodeNumber: r.episode_number,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.watched_at || r.created_at || new Date().toISOString(),
                isSeason: !r.episode_number,
                isEpisode: !!r.episode_number,
                source: 'supabase_diary'
            })),
            ...(epRatings.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seriesName: knownSeriesName || r.series_name || r.name || 'Show',
                name: knownSeriesName || r.series_name || r.name || 'Show',
                seasonNumber: r.season_number,
                episodeNumber: r.episode_number,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                rating: r.rating?.toString(),
                createdAt: r.created_at || r.updated_at || new Date().toISOString(),
                isEpisode: true,
                source: 'supabase_rating'
            })),
            ...(sRatings.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seriesName: knownSeriesName || r.series_name || r.name || 'Show',
                name: knownSeriesName || r.series_name || r.name || 'Show',
                seasonNumber: r.season_number,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                rating: r.rating?.toString(),
                createdAt: r.created_at || r.updated_at || new Date().toISOString(),
                isSeason: true,
                source: 'supabase_rating'
            }))
        ];

        // Deduplicate
        const seen = new Set();
        const unique = [];
        mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        for (const item of mapped) {
            const key = `${item.userId}-${item.seasonNumber}-${item.episodeNumber || 0}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(item);
            }
        }

        // Add Firebase
        const q = query(
            collection(db, 'reviews'),
            where('tmdbId', '==', tmdbId)
        );
        const fbSnap = await getDocs(q);
        const firebaseReviews = fbSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, source: 'firebase' }));

        const all = [...unique, ...firebaseReviews];
        return all.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
        console.error('[ReviewService] Unified Get Series Reviews Error:', error);
        return [];
    }
};

export const createEpisodeReview = async (
    userId: string,
    tmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
    reviewText: string,
    rating: number,
    userName: string,
    photoURL: string,
    seriesName: string,
    posterPath: string,
    reviewId: string | null = null
) => {
    try {
        const { isRestricted } = await banService.checkActionRestriction(userId, 'REVIEW');
        if (isRestricted) return false;

        const payload: any = {
            user_id: userId,
            tmdb_id: tmdbId,
            season_number: seasonNumber,
            episode_number: episodeNumber,
            review_text: reviewText,
            rating: rating,
            user_name: userName,
            photo_url: photoURL,
            series_name: seriesName,
            poster_path: posterPath,
            created_at: new Date().toISOString()
        };

        if (reviewId) payload.id = reviewId;

        const { error } = await supabase
            .from('episode_reviews')
            .upsert(payload, { onConflict: 'user_id,tmdb_id,season_number,episode_number' });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('[ReviewService] Create Episode Review Error:', error);
        throw error;
    }
};

export const createSeasonReview = async (
    userId: string,
    tmdbId: number,
    seasonNumber: number,
    reviewText: string,
    rating: number,
    userName: string,
    photoURL: string,
    seriesName: string,
    posterPath: string,
    reviewId: string | null = null
) => {
    try {
        const { isRestricted } = await banService.checkActionRestriction(userId, 'REVIEW');
        if (isRestricted) return false;

        const payload: any = {
            user_id: userId,
            tmdb_id: tmdbId,
            season_number: seasonNumber,
            review_text: reviewText,
            rating: rating,
            user_name: userName,
            photo_url: photoURL,
            series_name: seriesName,
            poster_path: posterPath,
            created_at: new Date().toISOString()
        };

        if (reviewId) payload.id = reviewId;

        const { error } = await supabase
            .from('season_reviews')
            .upsert(payload, { onConflict: 'user_id,tmdb_id,season_number' });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('[ReviewService] Create Season Review Error:', error);
        throw error;
    }
};

// ------------------------------------------------------------------
// UPDATE & DELETE: Using Composite Keys (User + Content) for Robustness
// ------------------------------------------------------------------

export const updateSeasonReview = async (
    userId: string,
    tmdbId: number,
    seasonNumber: number,
    reviewText: string,
    rating: number,
    userName: string,
    photoURL: string,
    seriesName: string,
    posterPath: string,
    reviewId: string, // Kept for interface compat, but using composite keys
    createdAt?: string
) => {
    try {
        const payload: any = {
            review_text: reviewText,
            rating: rating,
            user_name: userName,
            photo_url: photoURL,
            series_name: seriesName,
            poster_path: posterPath,
            updated_at: new Date().toISOString()
        };

        if (createdAt) payload.created_at = createdAt;

        const { error } = await supabase
            .from('season_reviews')
            .update(payload)
            .match({ user_id: userId, tmdb_id: tmdbId, season_number: seasonNumber });

        if (error) {
            console.error('[ReviewService] Supabase Update Error:', error);
            throw error;
        }
        return true;
    } catch (error) {
        console.error('[ReviewService] Update Season Review Failed:', error);
        throw error;
    }
};

export const updateEpisodeReview = async (
    userId: string,
    tmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
    reviewText: string,
    rating: number,
    userName: string,
    photoURL: string,
    seriesName: string,
    posterPath: string,
    reviewId: string,
    createdAt?: string
) => {
    try {
        const payload: any = {
            review_text: reviewText,
            rating: rating,
            user_name: userName,
            photo_url: photoURL,
            series_name: seriesName,
            poster_path: posterPath,
            updated_at: new Date().toISOString()
        };

        if (createdAt) payload.created_at = createdAt;

        const { error } = await supabase
            .from('episode_reviews')
            .update(payload)
            .match({ user_id: userId, tmdb_id: tmdbId, season_number: seasonNumber, episode_number: episodeNumber });

        if (error) {
            console.error('[ReviewService] Supabase Update Error:', error);
            throw error;
        }
        return true;
    } catch (error) {
        console.error('[ReviewService] Update Episode Review Failed:', error);
        throw error;
    }
};

export const getSeasonReviews = async (tmdbId: number, seasonNumber: number, knownSeriesName: string | null = null) => {
    try {
        const [
            epReviews,
            sReviews,
            diaryEntries,
            epRatings,
            sRatings
        ] = await Promise.all([
            supabase.from('episode_reviews').select('*').eq('tmdb_id', tmdbId).eq('season_number', seasonNumber),
            supabase.from('season_reviews').select('*').eq('tmdb_id', tmdbId).eq('season_number', seasonNumber),
            supabase.from('diary_entries').select('*').eq('tmdb_id', tmdbId).eq('season_number', seasonNumber),
            supabase.from('episode_ratings').select('*').eq('tmdb_id', tmdbId).eq('season_number', seasonNumber),
            supabase.from('season_ratings').select('*').eq('tmdb_id', tmdbId).eq('season_number', seasonNumber)
        ]);

        const mapped = [
            ...(epReviews.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seriesName: knownSeriesName || r.series_name || r.name || 'Show',
                name: knownSeriesName || r.series_name || r.name || 'Show',
                seasonNumber: r.season_number,
                episodeNumber: r.episode_number,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at || new Date().toISOString(),
                isEpisode: true,
                source: 'supabase_review'
            })),
            ...(sReviews.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seriesName: knownSeriesName || r.series_name || r.name || 'Show',
                name: knownSeriesName || r.series_name || r.name || 'Show',
                seasonNumber: r.season_number,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at || new Date().toISOString(),
                isSeason: true,
                source: 'supabase_review'
            })),
            ...(diaryEntries.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seriesName: knownSeriesName || r.series_name || r.name || 'Show',
                name: knownSeriesName || r.series_name || r.name || 'Show',
                seasonNumber: r.season_number,
                episodeNumber: r.episode_number,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.watched_at || r.created_at || new Date().toISOString(),
                isSeason: !r.episode_number,
                isEpisode: !!r.episode_number,
                source: 'supabase_diary'
            })),
            ...(epRatings.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seriesName: knownSeriesName || r.series_name || r.name || 'Show',
                name: knownSeriesName || r.series_name || r.name || 'Show',
                seasonNumber: r.season_number,
                episodeNumber: r.episode_number,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                rating: r.rating?.toString(),
                createdAt: r.created_at || r.updated_at || new Date().toISOString(),
                isEpisode: true,
                source: 'supabase_rating'
            })),
            ...(sRatings.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seriesName: knownSeriesName || r.series_name || r.name || 'Show',
                name: knownSeriesName || r.series_name || r.name || 'Show',
                seasonNumber: r.season_number,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                rating: r.rating?.toString(),
                createdAt: r.created_at || r.updated_at || new Date().toISOString(),
                isSeason: true,
                source: 'supabase_rating'
            }))
        ];

        // Deduplicate
        const seen = new Set();
        const unique = [];
        mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        for (const item of mapped) {
            const key = `${item.userId}-${item.seasonNumber}-${item.episodeNumber || 0}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(item);
            }
        }

        return unique.sort((a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    } catch (error) {
        console.error('[ReviewService] Unified Get Season Reviews Error:', error);
        return [];
    }
};

// DELETE via Composite Keys
// DELETE via Composite Keys
export const deleteEpisodeReview = async (userId: string, tmdbId: number, seasonNumber: number, episodeNumber: number) => {
    try {
        if (!userId || !tmdbId || isNaN(tmdbId) || seasonNumber === undefined || isNaN(seasonNumber) || episodeNumber === undefined || isNaN(episodeNumber)) {
            console.error('[ReviewService] Invalid Parameters for Episode Delete:', { userId, tmdbId, seasonNumber, episodeNumber });
            return { success: false, error: 'Invalid Parameters' };
        }

        console.log(`[ReviewService] Deleting Episode Review & Rating: ${tmdbId} S${seasonNumber}E${episodeNumber}`);

        // DELETE FROM BOTH TABLES PARALLEL
        const [reviewDel, ratingDel] = await Promise.all([
            supabase
                .from('episode_reviews')
                .delete()
                .match({ user_id: userId, tmdb_id: tmdbId, season_number: seasonNumber, episode_number: episodeNumber }),
            supabase
                .from('episode_ratings')
                .delete()
                .match({ user_id: userId, tmdb_id: tmdbId, season_number: seasonNumber, episode_number: episodeNumber })
        ]);

        if (reviewDel.error) throw reviewDel.error;
        // We generally treat rating deletion error as non-fatal if review is deleted, but good to log
        if (ratingDel.error) console.warn('[ReviewService] Rating delete warning:', ratingDel.error);

        return { success: true };
    } catch (error) {
        console.error('[ReviewService] Delete Episode Review Error:', error);
        return { success: false, error };
    }
};

export const deleteSeasonReview = async (userId: string, tmdbId: number, seasonNumber: number) => {
    try {
        if (!tmdbId || isNaN(tmdbId) || seasonNumber === undefined || isNaN(seasonNumber)) {
            console.error('[ReviewService] Invalid Check for Delete:', { tmdbId, seasonNumber });
            return { success: false, error: 'Invalid Parameters' };
        }

        console.log(`[ReviewService] Deleting Season Review & Rating: ${tmdbId} S${seasonNumber}`);

        // DELETE FROM BOTH TABLES PARALLEL
        const [reviewDel, ratingDel] = await Promise.all([
            supabase
                .from('season_reviews')
                .delete()
                .match({ user_id: userId, tmdb_id: tmdbId, season_number: seasonNumber }),
            supabase
                .from('season_ratings')
                .delete()
                .match({ user_id: userId, tmdb_id: tmdbId, season_number: seasonNumber })
        ]);

        if (reviewDel.error) throw reviewDel.error;
        if (ratingDel.error) console.warn('[ReviewService] Rating delete warning:', ratingDel.error);

        return { success: true };
    } catch (error) {
        console.error('[ReviewService] Delete Season Review Error:', error);
        return { success: false, error };
    }
};

export const getPaginatedSeasonReviews = async (
    tmdbId: number,
    seasonNumber: number,
    limit: number = 10,
    cursor?: string | null,
    userIds?: string[],
    excludeUserIds?: string[]
) => {
    try {
        let seasonQuery = supabase
            .from('season_reviews')
            .select('*')
            .eq('tmdb_id', tmdbId)
            .in('season_number', [seasonNumber, 0])
            .order('created_at', { ascending: false })
            .limit(limit);

        let episodeQuery = supabase
            .from('episode_reviews')
            .select('*')
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (cursor) {
            seasonQuery = seasonQuery.lt('created_at', cursor);
            episodeQuery = episodeQuery.lt('created_at', cursor);
        }

        if (userIds && userIds.length > 0) {
            // Note: Supabase 'in' takes an array for the value
            seasonQuery = seasonQuery.in('user_id', userIds);
            episodeQuery = episodeQuery.in('user_id', userIds);
        }

        if (excludeUserIds && excludeUserIds.length > 0) {
            // Note: not('col', 'in', '(a,b)') syntax is specific; standard 'not.in' is safer if available, but .not() works
            seasonQuery = seasonQuery.not('user_id', 'in', `(${excludeUserIds.join(',')})`);
            episodeQuery = episodeQuery.not('user_id', 'in', `(${excludeUserIds.join(',')})`);
        }

        const [seasonRes, episodesRes] = await Promise.all([seasonQuery, episodeQuery]);

        if (seasonRes.error) throw seasonRes.error;
        if (episodesRes.error) throw episodesRes.error;

        const allReviews = [
            ...(seasonRes.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seasonNumber: r.season_number,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at || new Date().toISOString(),
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                isSeason: true,
                source: 'supabase'
            })),
            ...(episodesRes.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seasonNumber: r.season_number,
                episodeNumber: r.episode_number,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at || new Date().toISOString(),
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                isEpisode: true,
                source: 'supabase'
            }))
        ];

        // Sort Combined
        const sorted = allReviews.sort((a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Take only Limit
        const sliced = sorted.slice(0, limit);
        const nextCursor = sliced.length > 0 ? sliced[sliced.length - 1].createdAt : null;

        return { data: sliced, nextCursor };
    } catch (error) {
        console.error('[ReviewService] Paginated Fetch Error:', error);
        return { data: [], nextCursor: null };
    }
};
