import { supabase } from './supabase';
import { tmdbApi } from './tmdb';
import { getPosterUnlockStatus } from './poster-unlock';
import * as watchlistService from './watchlist-service';
import * as diaryService from './diary-service';
import * as ratingService from './rating-service';

export const checkCompletion = async (userId: string, tmdbId: number) => {
    if (!userId || !tmdbId) return;

    try {
        // 1. Fetch series details to know total seasons/episodes
        const details = await tmdbApi.getSeriesDetails(tmdbId);
        const regularSeasons = (details.seasons || []).filter((s: any) => s.season_number > 0);
        const totalSeasons = regularSeasons.length;

        // 2. Fetch watched data from Supabase
        const { data: watchedData, error } = await supabase
            .from('watched_episodes')
            .select('season_number, episode_number')
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId);

        if (error) throw error;

        // 3. Filter seasons that have actually AIRED (ignore future ones for completion)
        const today = new Date().toISOString().split('T')[0];
        const airedSeasons = regularSeasons.filter((s: any) => {
            // If air_date is null or in the future, it's not "aired" yet for completion purposes
            return s.air_date && s.air_date <= today && s.episode_count > 0;
        });

        if (airedSeasons.length === 0) return { isSeriesCompleted: false, completedSeasonsCount: 0, totalSeasons: 0 };

        // 4. Count completed seasons
        let completedSeasonsCount = 0;
        let isSeriesCompleted = true;

        for (const season of airedSeasons) {
            const watchedInSeason = watchedData?.filter(w => w.season_number === season.season_number) || [];
            if (watchedInSeason.length >= season.episode_count) {
                completedSeasonsCount++;
            } else {
                isSeriesCompleted = false;
            }
        }

        // Note: completion-service now only handles on-the-fly checks and diary triggers.
        // Persistent completion tables (like completed_series) were removed as they are not in the current DB schema.

        // 5. Unlock Posters logic
        // We need to know total posters available for this series to use getPosterUnlockStatus
        // For simplicity, we can assume a standard set or fetch if possible.
        // Usually posters are unlocked based on completion percentage.
        // The user mentioned: "watching seasons it unlocks posters".

        // This is a placeholder for actual unlocking logic in user_posters if needed.
        // Actually, the app seems to calculate unlockCount on the fly using getPosterUnlockStatus.
        // But we might want to store the "highest reached" or similar.

        return {
            isSeriesCompleted,
            completedSeasonsCount,
            totalSeasons
        };

    } catch (err) {
        console.error('[CompletionService] Error:', err);
    }
};

/**
 * Checks if all episodes in a season are rated/watched and triggers side effects:
 * 1. All Rated -> Create Diary Entry
 * 2. All Watched -> Remove from Watchlist & Mark Season Watched
 */
export const checkEpisodeProgress = async (userId: string, tmdbId: number, seasonNumber: number) => {
    if (!userId || !tmdbId || !seasonNumber) return;

    try {
        // 1. Get Season Details for Episode Count
        const season = await tmdbApi.getSeasonDetails(tmdbId, seasonNumber);
        if (!season || !season.episodes) return;
        const totalEpisodes = season.episodes.length;

        // 2. Check Ratings & Watched Status in Parallel
        const [ratingsRes, watchedRes] = await Promise.all([
            supabase
                .from('episode_ratings')
                .select('episode_number')
                .eq('user_id', userId)
                .eq('tmdb_id', tmdbId)
                .eq('season_number', seasonNumber),
            supabase
                .from('watched_episodes')
                .select('episode_number')
                .eq('user_id', userId)
                .eq('tmdb_id', tmdbId)
                .eq('season_number', seasonNumber)
        ]);

        const ratedCount = ratingsRes.data?.length || 0;
        const watchedCount = watchedRes.data?.length || 0;

        // Fetch series details for metadata (Shared for both Logic A and NEW LOGIC)
        const seriesDetails = await tmdbApi.getSeriesDetails(tmdbId);
        const seriesData = {
            id: tmdbId,
            name: seriesDetails?.name || 'Unknown Series',
            poster_path: season?.poster_path || seriesDetails?.poster_path
        };

        // NEW LOGIC: INDIVIDUAL EPISODE DIARY (Triggered on every rating)
        // We find the specific rating that was just added/updated
        const { data: latestRating } = await supabase
            .from('episode_ratings')
            .select('rating, episode_number')
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (latestRating) {
            console.log(`[CompletionService] Creating/Updating Episode Diary for S${seasonNumber}E${latestRating.episode_number}`);
            await diaryService.createDiaryEntry(
                userId,
                seriesData,
                seasonNumber,
                {
                    rating: latestRating.rating,
                    episodeNumber: latestRating.episode_number,
                    review: "", // Rating only initially
                    poster_path: seriesData.poster_path
                }
            );
        }

        // LOGIC A: ALL RATED -> TRIGGER SEASON DIARY
        if (ratedCount >= totalEpisodes) {
            console.log(`[CompletionService] All episodes rated for S${seasonNumber}. Creating Season Diary entry.`);

            // Calculate exact average from DB
            const { data: fullRatings } = await supabase
                .from('episode_ratings')
                .select('rating')
                .eq('user_id', userId)
                .eq('tmdb_id', tmdbId)
                .eq('season_number', seasonNumber);

            const avgRating = fullRatings && fullRatings.length > 0
                ? fullRatings.reduce((acc, r) => acc + Number(r.rating || 0), 0) / fullRatings.length
                : 0;

            // Immediate Diary Reflection
            await diaryService.createDiaryEntry(
                userId,
                seriesData,
                seasonNumber,
                {
                    rating: Math.ceil(avgRating * 2) / 2, // Round up to nearest 0.5 for better feel
                    review: "Automatically added: All episodes in this season have been rated.",
                    poster_path: seriesData.poster_path
                }
            );
        }

        // LOGIC B: ALL WATCHED -> UI will reflect this via on-the-fly completion checks
        if (watchedCount >= totalEpisodes) {
            console.log(`[CompletionService] All episodes watched for S${seasonNumber}. Updating status.`);

            // 1. Remove from Watchlist (Immediate DB reflection)
            await watchlistService.removeFromWatchlist(userId, tmdbId);

            // 2. Sync Series Graph (via on-the-fly refresh in UI)
            await checkCompletion(userId, tmdbId);
        }

    } catch (err) {
        console.error('[CompletionService] Episode progress check failed:', err);
    }
};
