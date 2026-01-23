import { db } from './firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import * as diaryService from './diary-service';
import * as watchlistService from './watchlist-service';
import { getUserLikes } from './likes-service';
import * as ratingService from './rating-service';
import { supabase } from './supabase';
import { tmdbApi } from './tmdb';

const hydrateLikes = async (likesList: any[]) => {
    if (!likesList || likesList.length === 0) return [];

    // Deduplicate input list by id (composite key)
    const uniqueLikesMap = new Map<string, any>();
    likesList.forEach(l => uniqueLikesMap.set(l.id, l));
    const dedupedList = Array.from(uniqueLikesMap.values());

    const uniqueIds = [...new Set(dedupedList.map(l => l.tmdbId))];
    const seriesMap: { [key: number]: any } = {};

    const BATCH_SIZE = 5;
    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
        const batch = uniqueIds.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(async (id) => {
            try {
                return await tmdbApi.getSeriesDetails(String(id));
            } catch (e) {
                console.warn(`Failed to hydrate series ${id}`, e);
                return null;
            }
        }));

        results.forEach(series => {
            if (series) seriesMap[series.id] = series;
        });

        if (i + BATCH_SIZE < uniqueIds.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return dedupedList.map(item => {
        const series = seriesMap[item.tmdbId];
        let poster = null;
        let name = 'Unknown Series';

        if (series) {
            poster = series.poster_path;
            name = series.name;
            if (item.type === 'SEASON' && item.seasonNumber && series.seasons) {
                const s = series.seasons.find((sea: any) => sea.season_number === item.seasonNumber);
                if (s && s.poster_path) poster = s.poster_path;
            }
        }

        return {
            ...item,
            poster_path: poster,
            seasonPoster: (item.type === 'SEASON') ? poster : null,
            seriesName: name
        };
    });
};

export const getUserProfileData = async (userId: string) => {
    if (!userId) return null;

    try {
        const [
            userSnap,
            diary,
            watchlist,
            rawLikes,
            ratings,
            activitySnap,
            postersResult
        ] = await Promise.all([
            getDoc(doc(db, 'users', userId)),
            diaryService.getUserDiary(userId),
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
                .select('series_id, poster_path')
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
                photoURL: data.photoURL || null
            };
        }

        const activityPreview = activitySnap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
        const likes = await hydrateLikes(rawLikes);

        return {
            userInfo,
            diary: diary || [],
            watchlist: watchlist || [],
            likes: likes || [],
            ratings: ratings || { episodes: [], seasons: [] },
            activityPreview: activityPreview || [],
            userPosters: ((postersResult as any)?.data || []).reduce((acc: any, row: any) => {
                if (row.series_id && row.poster_path) acc[row.series_id] = row.poster_path;
                return acc;
            }, {})
        };

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
