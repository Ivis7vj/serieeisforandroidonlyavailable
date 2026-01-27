import { db } from './firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, writeBatch } from 'firebase/firestore';
import * as diaryService from './diary-service';
import * as watchlistService from './watchlist-service';
import { getUserLikes } from './likes-service';
import * as ratingService from './rating-service';
import { supabase } from './supabase';
import { tmdbApi } from './tmdb';
import { getUserReviews } from './review-service';

const hydrateMediaItems = async (items: any[]) => {
    if (!items || items.length === 0) return [];

    // CRITICAL: We need the parent SERIES details to get the 'seasons' array
    const uniqueIds = [...new Set(items.map(l => {
        const sid = l.seriesId || l.series_id;
        const tid = l.tmdbId || l.tmdb_id;
        // If it has a seriesId (like seasons/episodes do), use that for hydration
        return sid || tid;
    }).filter(Boolean))];

    const seriesMap: { [key: number]: any } = {};

    // Parallel fetch for speed
    const BATCH_SIZE = 10;
    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
        const batch = uniqueIds.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(async (id) => {
            try {
                return await tmdbApi.getSeriesDetails(String(id));
            } catch (e) {
                return null;
            }
        }));

        results.forEach(series => {
            if (series) seriesMap[series.id] = series;
        });
    }

    return items.map(item => {
        const sid = item.seriesId || item.series_id;
        const tid = item.tmdbId || item.tmdb_id;
        const series = seriesMap[sid || tid];

        let poster = item.poster_path || item.posterPath;
        let name = item.name || item.seriesName || 'Unknown Series';

        if (series) {
            // Default to series level if no season specific found later
            poster = series.poster_path;
            name = series.name;
            const sNum = item.seasonNumber || item.season_number;
            const isSeasonOrEp = (item.type === 'SEASON' || item.type === 'EPISODE' || item.isSeason || item.isEpisode);

            if (isSeasonOrEp && sNum !== undefined && sNum !== null && series.seasons) {
                const s = series.seasons.find((sea: any) => Number(sea.season_number) === Number(sNum));
                if (s && s.poster_path) {
                    poster = s.poster_path;
                }
            }
        }

        return {
            ...item,
            poster_path: poster,
            seasonPoster: poster,
            seriesName: name
        };
    });
};

export const getUserProfileData = async (userId: string) => {
    if (!userId) return null;

    try {
        const [
            userSnap,
            diaryReviews, // Fetched from Supabase (Source of Truth)
            watchlist,
            rawLikes,
            ratings,
            activitySnap,
            postersResult
        ] = await Promise.all([
            getDoc(doc(db, 'users', userId)),
            diaryService.getUserDiary(userId), // Strictly pull from diary_entries table
            watchlistService.getWatchlist(userId),
            getUserLikes(userId),
            ratingService.getUserRatings(userId),
            getDocs(query(
                collection(db, 'user_activity'),
                where('userId', '==', userId),
                orderBy('createdAt', 'desc'),
                limit(10)
            )).catch(err => {
                console.warn("Activity Feed fetch failed:", err);
                return { docs: [] } as any;
            }),
            supabase
                .from('user_posters')
                .select('series_id, poster_path, is_true')
                .eq('user_id', userId)
        ]);

        let userInfo = null;
        if (userSnap.exists()) {
            const data = userSnap.data();
            userInfo = {
                ...data,
                username: data.username || data.email?.split('@')[0] || 'User',
                followers: data.followers || [],
                following: data.following || [],
                notifications: data.notifications || [],
                favorites: data.favorites || [],
                achievements: data.achievements || [],
                starSeries: data.starSeries || [],
                bannerBackdropPath: data.bannerBackdropPath || null,
                photoURL: data.photoURL || null,
                customPosters: data.customPosters || null // Include customPosters
            };
        }

        const activityPreview = activitySnap.docs.map((d: any) => ({ ...d.data(), id: d.id }));

        // Hydrate both Lists for season-specific posters
        const [likes, hydratedWatchlist, hydratedDiary] = await Promise.all([
            hydrateMediaItems(rawLikes),
            hydrateMediaItems(watchlist),
            hydrateMediaItems(diaryReviews || [])
        ]);

        // Diary entries from diaryService.getUserDiary are already normalized
        const diary = hydratedDiary || [];

        // Helper to attach ratings
        const mergeRatings = (items: any[]) => {
            if (!items) return [];
            return items.map(item => {
                let ratingVal = null;
                const tmdbId = item.tmdbId || item.tmdb_id || item.seriesId || item.id;
                const sNum = item.seasonNumber || item.season_number;
                const epNum = item.episodeNumber || item.episode_number;

                // 1. Check Episode Ratings
                if (epNum !== undefined && sNum !== undefined) {
                    const found = (ratings.episodes || []).find((r: any) =>
                        r.tmdb_id == tmdbId && r.season_number == sNum && r.episode_number == epNum
                    );
                    if (found) ratingVal = found.rating;
                }
                // 2. Check Season Ratings (if no episode rating found or it's a season item)
                if (!ratingVal && sNum !== undefined) {
                    const found = (ratings.seasons || []).find((r: any) =>
                        r.tmdb_id == tmdbId && r.season_number == sNum
                    );
                    if (found) ratingVal = found.rating;
                }

                return { ...item, rating: ratingVal };
            });
        };

        const ratedLikes = mergeRatings(likes);
        const ratedWatchlist = mergeRatings(hydratedWatchlist);

        const result = {
            userInfo,
            diary: diary, // Now seeded from Supabase Reviews
            watchlist: ratedWatchlist || [],
            likes: ratedLikes || [],
            ratings: ratings || { episodes: [], seasons: [] },
            activityPreview: activityPreview || [],
            userPosters: userInfo?.customPosters || {}
        };

        // 🚀 BACKGROUND SYNC: Ensure DB records match latest poster choices
        if (userId && userInfo?.customPosters) {
            syncPosterPaths(userId, userInfo.customPosters);
        }

        return result;

    } catch (error) {
        console.error("Error in getUserProfileData:", error);
        return {
            userInfo: null,
            diary: [],
            watchlist: [],
            likes: [],
            ratings: { episodes: [], seasons: [] },
            activityPreview: [],
            userPosters: {}
        };
    }
};

/**
 * 🔄 POSTER SYNC
 * Updates Supabase records if they are out of sync with User Customizations.
 * This ensures "Public Profiles" show the author's chosen posters.
 */
export const syncPosterPaths = async (userId: string, customPosters: any) => {
    if (!userId || !customPosters || Object.keys(customPosters).length === 0) return;

    try {
        const [reviews, diary] = await Promise.all([
            getUserReviews(userId),
            diaryService.getUserDiary(userId)
        ]);

        const updates: Promise<any>[] = [];

        // 1. Sync Reviews (Seasons & Episodes)
        reviews.forEach((r: any) => {
            const key = r.isEpisode ? `${r.tmdbId}_${r.seasonNumber}_${r.episodeNumber}` : `${r.tmdbId}_${r.seasonNumber}`;
            const seriesKey = `${r.tmdbId}_0`;
            const custom = customPosters[key] || customPosters[seriesKey] || customPosters[r.tmdbId];
            const latestPath = custom ? (typeof custom === 'string' ? custom : custom.path) : null;

            if (latestPath && r.poster_path !== latestPath) {
                const table = r.isEpisode ? 'episode_reviews' : 'season_reviews';
                updates.push(supabase.from(table).update({ poster_path: latestPath }).eq('id', r.id) as any);
            }
        });

        // 2. Sync Diary
        diary.forEach((d: any) => {
            const key = `${d.tmdbId}_${d.seasonNumber}`;
            const seriesKey = `${d.tmdbId}_0`;
            const custom = customPosters[key] || customPosters[seriesKey] || customPosters[d.tmdbId];
            const latestPath = custom ? (typeof custom === 'string' ? custom : custom.path) : null;

            if (latestPath && d.posterPath !== latestPath) {
                updates.push(supabase.from('diary_entries').update({ poster_path: latestPath }).eq('id', d.id).then());
            }
        });

        if (updates.length > 0) {
            console.log(`[PosterSync] Updating ${updates.length} records for user ${userId}`);
            await Promise.all(updates);
        }
    } catch (e) {
        console.warn("[PosterSync] Failed:", e);
    }
};
