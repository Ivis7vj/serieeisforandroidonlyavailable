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
                createdAt: review.created_at,
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
        const [episodeReviews, seasonReviews] = await Promise.all([
            supabase
                .from('episode_reviews')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false }),
            supabase
                .from('season_reviews')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
        ]);

        const supabaseReviews = [
            ...(episodeReviews.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seriesId: r.series_id,
                seasonNumber: r.season_number,
                episodeNumber: r.episode_number,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at,
                name: r.series_name,
                poster_path: r.poster_path,
                isEpisode: true,
                source: 'supabase'
            })),
            ...(seasonReviews.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seasonNumber: r.season_number,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at,
                name: r.series_name,
                poster_path: r.poster_path,
                isSeason: true,
                source: 'supabase'
            }))
        ];

        // ADD FIREBASE FALLBACK
        const q = query(
            collection(db, 'reviews'),
            where('userId', '==', userId)
        );
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

        const allReviews = [...supabaseReviews, ...firebaseReviews];

        return allReviews.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    } catch (error) {
        console.error('[ReviewService] Get User Reviews Error:', error);
        return [];
    }
};

export const getSeriesReviews = async (tmdbId: number) => {
    try {
        const [episodeReviews, seasonReviews] = await Promise.all([
            supabase
                .from('episode_reviews')
                .select('*')
                .eq('tmdb_id', tmdbId)
                .order('created_at', { ascending: false }),
            supabase
                .from('season_reviews')
                .select('*')
                .eq('tmdb_id', tmdbId)
                .order('created_at', { ascending: false })
        ]);

        const supabaseReviews = [
            ...(episodeReviews.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seasonNumber: r.season_number,
                episodeNumber: r.episode_number,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                isEpisode: true,
                source: 'supabase'
            })),
            ...(seasonReviews.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seasonNumber: r.season_number,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                isSeason: true,
                source: 'supabase'
            }))
        ];

        // ADD FIREBASE FALLBACK
        const q = query(
            collection(db, 'reviews'),
            where('tmdbId', '==', tmdbId)
        );
        const fbSnap = await getDocs(q);
        const firebaseReviews = fbSnap.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
            source: 'firebase'
        }));

        const allReviews = [...supabaseReviews, ...firebaseReviews];

        return allReviews.sort((a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    } catch (error) {
        console.error('[ReviewService] Get Series Reviews Error:', error);
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

        if (createdAt) {
            payload.created_at = createdAt;
        }

        const { error } = await supabase
            .from('season_reviews')
            .update(payload)
            .eq('id', reviewId)
            .eq('user_id', userId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('[ReviewService] Update Season Review Error:', error);
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

        if (createdAt) {
            payload.created_at = createdAt;
        }

        const { error } = await supabase
            .from('episode_reviews')
            .update(payload)
            .eq('id', reviewId)
            .eq('user_id', userId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('[ReviewService] Update Episode Review Error:', error);
        throw error;
    }
};

export const getSeasonReviews = async (tmdbId: number, seasonNumber: number) => {
    try {
        const [seasonRes, episodesRes] = await Promise.all([
            supabase
                .from('season_reviews')
                .select('*')
                .eq('tmdb_id', tmdbId)
                .eq('season_number', seasonNumber)
                .order('created_at', { ascending: false }),
            supabase
                .from('episode_reviews')
                .select('*')
                .eq('tmdb_id', tmdbId)
                .eq('season_number', seasonNumber)
                .order('created_at', { ascending: false })
        ]);

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
                createdAt: r.created_at,
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
                createdAt: r.created_at,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                isEpisode: true,
                source: 'supabase'
            }))
        ];

        return allReviews.sort((a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    } catch (error) {
        console.error('[ReviewService] Get Season Reviews Error:', error);
        return [];
    }
};

export const deleteEpisodeReview = async (reviewId: string) => {
    try {
        const { error } = await supabase
            .from('episode_reviews')
            .delete()
            .eq('id', reviewId);
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('[ReviewService] Delete Episode Review Error:', error);
        return { success: false, error };
    }
};

export const deleteSeasonReview = async (reviewId: string) => {
    try {
        const { error } = await supabase
            .from('season_reviews')
            .delete()
            .eq('id', reviewId);
        if (error) throw error;
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
            .eq('season_number', seasonNumber)
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
                createdAt: r.created_at,
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
                createdAt: r.created_at,
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
