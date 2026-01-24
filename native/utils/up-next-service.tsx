import React from 'react';
import { supabase } from './supabase';
import { tmdbApi } from './tmdb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { UpNextWidget } from '@/components/widget/UpNextWidget';

export interface UpNextItem {
    tmdbId: number;
    seriesName: string;
    posterPath: string;
    backdropPath: string;
    seasonNumber: number;
    episodeNumber: number;
    nextEpisodeNumber: number;
    nextSeasonNumber: number;
    totalEpisodesInSeason: number;
    lastWatchedEpisode: number;
    lastWatchedSeason: number;
}

export const getUpNextData = async (userId: string): Promise<UpNextItem[]> => {
    if (!userId) return [];

    try {
        // 1. Get all activities (Watched, Rated, Reviewed)
        const [watchedRes, ratedRes, reviewedRes] = await Promise.all([
            supabase
                .from('watched_episodes')
                .select('tmdb_id, season_number, episode_number, watched_at')
                .eq('user_id', userId)
                .limit(10000),
            supabase
                .from('episode_ratings')
                .select('tmdb_id, season_number, episode_number, updated_at')
                .eq('user_id', userId)
                .limit(10000),
            supabase
                .from('episode_reviews')
                .select('tmdb_id, season_number, episode_number, created_at')
                .eq('user_id', userId)
                .limit(10000)
        ]);

        if (watchedRes.error) throw watchedRes.error;
        if (ratedRes.error) throw ratedRes.error;
        if (reviewedRes.error) throw reviewedRes.error;

        const allActivities = [
            ...(watchedRes.data || []).map(i => ({ ...i, ts: new Date(i.watched_at).getTime() })),
            ...(ratedRes.data || []).map(i => ({ ...i, ts: new Date(i.updated_at).getTime() })),
            ...(reviewedRes.data || []).map(i => ({ ...i, ts: new Date(i.created_at).getTime() }))
        ];

        if (allActivities.length === 0) return [];

        // 2. Group by tmdb_id to find:
        //    a) Max (Season, Episode) - to know where they are
        //    b) Max Timestamp - to know how recent the interaction was
        const seriesMap: Record<number, { s: number; e: number; lastActive: number }> = {};

        allActivities.forEach(item => {
            const id = item.tmdb_id;
            if (!seriesMap[id]) {
                seriesMap[id] = { s: item.season_number, e: item.episode_number, lastActive: item.ts };
            } else {
                const current = seriesMap[id];

                // Update Max Position
                if (item.season_number > current.s || (item.season_number === current.s && item.episode_number > current.e)) {
                    current.s = item.season_number;
                    current.e = item.episode_number;
                }

                // Update Recency
                if (item.ts > current.lastActive) {
                    current.lastActive = item.ts;
                }
            }
        });

        console.log('[UpNextService] Series Map size:', Object.keys(seriesMap).length);

        const upNextList: (UpNextItem & { lastActive: number })[] = [];

        // 3. For each series, fetch details and determine next episode
        const seriesIds = Object.keys(seriesMap).map(Number);

        const detailsResults = await Promise.all(
            seriesIds.map(id => tmdbApi.getSeriesDetails(id).catch(() => null))
        );

        for (let i = 0; i < seriesIds.length; i++) {
            const tmdbId = seriesIds[i];
            const details = detailsResults[i];
            const last = seriesMap[tmdbId];

            if (!details) continue;

            const currentSeason = details.seasons?.find((s: any) => s.season_number === last.s);
            if (!currentSeason) continue;

            let nextS = last.s;
            let nextE = last.e + 1;
            let isEligible = false;
            let totalEps = currentSeason.episode_count;

            if (nextE <= currentSeason.episode_count) {
                isEligible = true;
            } else {
                const nextSeason = details.seasons?.find((s: any) => s.season_number === last.s + 1);
                if (nextSeason && nextSeason.episode_count > 0) {
                    nextS = last.s + 1;
                    nextE = 1;
                    isEligible = true;
                    totalEps = nextSeason.episode_count;
                }
            }

            if (isEligible) {
                upNextList.push({
                    tmdbId: details.id,
                    seriesName: details.name,
                    posterPath: details.poster_path,
                    backdropPath: details.backdrop_path,
                    seasonNumber: nextS,
                    episodeNumber: nextE,
                    nextEpisodeNumber: nextE,
                    nextSeasonNumber: nextS,
                    totalEpisodesInSeason: totalEps,
                    lastWatchedEpisode: last.e,
                    lastWatchedSeason: last.s,
                    lastActive: last.lastActive // Attach timestamp for sorting
                });
            }
        }

        // 4. Sort by Recency (Newest First)
        upNextList.sort((a, b) => b.lastActive - a.lastActive);

        if (upNextList.length > 0) {
            updateHomeWidget(upNextList[0]);
        }

        return upNextList;
    } catch (error) {
        console.error('[UpNextService] Error:', error);
        return [];
    }
};

export const updateHomeWidget = async (item?: UpNextItem) => {
    try {
        const widgetData = item ? {
            seriesName: item.seriesName,
            episodeInfo: `S${item.nextSeasonNumber} • E${item.nextEpisodeNumber}`,
            backdropUri: item.backdropPath ? `https://image.tmdb.org/t/p/w500${item.backdropPath}` : ''
        } : {
            seriesName: 'No Up Next',
            episodeInfo: 'Watch something!',
            backdropUri: ''
        };

        await AsyncStorage.setItem('@widget_data', JSON.stringify(widgetData));

        if (typeof requestWidgetUpdate !== 'undefined') {
            await requestWidgetUpdate({
                widgetName: 'UpNextWidgetProvider',
                renderWidget: () => (
                    <UpNextWidget
                        seriesName={widgetData.seriesName}
                        episodeInfo={widgetData.episodeInfo}
                        backdropUri={widgetData.backdropUri}
                    />
                )
            });
        }
    } catch (e: any) {
        // Silence "not linked" error in Expo Go
        const errorMsg = e?.message || '';
        if (errorMsg.includes('not seem to be linked') || errorMsg.includes('Expo Go')) {
            console.log('[UpNextService] Widget update skipped (Expo Go detected)');
        } else {
            console.error('[UpNextService] Widget Update Error:', e);
        }
    }
};
