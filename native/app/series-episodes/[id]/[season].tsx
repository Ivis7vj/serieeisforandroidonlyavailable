import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    ActivityIndicator,
    Platform,
    Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth-context';
import { tmdbApi } from '@/utils/tmdb';
import * as watchedService from '@/utils/watched-service';
import * as watchlistService from '@/utils/watchlist-service';
import * as reviewService from '@/utils/review-service';
import { triggerSelection } from '@/utils/haptics';
import EpisodesTab from '@/components/series/EpisodesTab';

const { width } = Dimensions.get('window');

export default function FullEpisodesScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser, userData } = useAuth();

    const seriesId = parseInt(params.id as string);
    const seasonNum = parseInt(params.season as string);
    const seriesName = params.name as string || 'Series';

    const [episodes, setEpisodes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [reviews, setReviews] = useState<any[]>([]);
    const [watchedIDs, setWatchedIDs] = useState<Set<string>>(new Set());
    const [watchlistIDs, setWatchlistIDs] = useState<number[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                // 1. Fetch Season Details
                const data = await tmdbApi.getSeasonDetails(seriesId, seasonNum);
                setEpisodes(data.episodes || []);

                // 2. Load Reviews (Fetch ALL series reviews so episode ratings show up)
                const revs = await reviewService.getSeriesReviews(seriesId);
                setReviews(revs || []);

                if (currentUser) {
                    // 3. Sync User Data (Watched)
                    const watchedList = await watchedService.getWatchedEpisodes(currentUser.uid, seriesId);
                    const newSet = new Set<string>(
                        watchedList
                            .filter((w: any) => w.season === seasonNum)
                            .map((w: any) => `${w.season}-${w.episode}`)
                    );
                    setWatchedIDs(newSet);

                    // 4. Sync User Data (Watchlist)
                    const userWatchlist = await watchlistService.getWatchlist(currentUser.uid);
                    const watchlistEps = userWatchlist
                        .filter((i: any) => i.seriesId === seriesId && i.isEpisode && i.seasonNumber === seasonNum)
                        .map((i: any) => i.id || i.tmdb_id);
                    setWatchlistIDs(watchlistEps);
                }
            } catch (error) {
                console.error("FullEpisodesScreen Data Load Error:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [seriesId, seasonNum, currentUser]);

    // PORT OVER LOGIC FROM SeriesDetails
    const toggleEpisodeWatched = async (ep: any) => {
        if (!currentUser) return;
        triggerSelection();
        const key = `${ep.season_number}-${ep.episode_number}`;
        const newWatched = new Set(watchedIDs);

        if (newWatched.has(key)) {
            newWatched.delete(key);
            await watchedService.unmarkEpisodeWatched(currentUser.uid, seriesId, ep.season_number, ep.episode_number);
        } else {
            newWatched.add(key);
            await watchedService.markEpisodeWatched(currentUser.uid, seriesId, ep.season_number, ep.episode_number);
        }
        setWatchedIDs(newWatched);
    };

    const toggleEpisodeWatchlist = async (ep: any) => {
        if (!currentUser) return;
        triggerSelection();
        if (watchlistIDs.includes(ep.id)) {
            setWatchlistIDs(prev => prev.filter(id => id !== ep.id));
            await watchlistService.removeFromWatchlist(currentUser.uid, ep.id);
        } else {
            setWatchlistIDs(prev => [...prev, ep.id]);
            const itemToSave = {
                id: ep.id,
                name: `${seriesName} - S${ep.season_number}E${ep.episode_number}: ${ep.name}`,
                poster_path: params.poster_path as string || '',
                seasonPoster: params.poster_path as string || '',
                still_path: ep.still_path,
                vote_average: ep.vote_average,
                first_air_date: ep.air_date,
                type: 'episode',
                isEpisode: true,
                seriesId: seriesId,
                seasonNumber: ep.season_number,
                episodeNumber: ep.episode_number
            };
            await watchlistService.addToWatchlist(currentUser.uid, itemToSave);
        }
    };

    const handleReviewPress = (ep: any) => {
        router.push({
            pathname: '/review',
            params: {
                type: 'episode',
                id: seriesId,
                season: ep.season_number,
                episode: ep.episode_number,
                name: seriesName,
                poster_path: ep.still_path || params.poster_path as string || ''
            }
        });
    };

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={[styles.header, { height: 60 + insets.top, paddingTop: insets.top }]}>
                <View style={styles.headerInner}>
                    <Pressable
                        onPress={() => router.back()}
                        style={styles.backBtn}
                        hitSlop={15}
                    >
                        <ArrowLeft color="#FFF" size={28} />
                    </Pressable>

                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            Season {seasonNum}
                        </Text>
                    </View>
                </View>
            </View>

            {/* CONTENT */}
            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator color="#FFD600" size="large" />
                </View>
            ) : (
                <ScrollView
                    style={styles.scrollContent}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
                    showsVerticalScrollIndicator={false}
                >
                    <EpisodesTab
                        episodes={episodes}
                        seriesId={seriesId}
                        seriesName={seriesName}
                        posterPath={params.poster_path as string || ''}
                        userData={userData || currentUser}
                        onToggleWatched={toggleEpisodeWatched}
                        onToggleWatchlist={toggleEpisodeWatchlist}
                        watchlistIDs={watchlistIDs}
                        watchedIDs={watchedIDs}
                        reviews={reviews}
                        onReviewPress={handleReviewPress}
                        isFullList={true}
                    />
                </ScrollView>
            )}

            {/* STATIC FOOTER (Placeholder for layout parity) */}
            <View style={[styles.footer, { height: 20 + insets.bottom }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        backgroundColor: '#000',
        width: '100%',
        zIndex: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
    },
    headerInner: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20, // Rule: Match global 20px padding
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
        height: '100%',
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.5,
        marginLeft: 8,
        zIndex: 5,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        flex: 1,
    },
    footer: {
        backgroundColor: '#000',
        width: '100%',
    }
});
