import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { tmdbApi } from '@/utils/tmdb';
import Skeleton from '@/components/skeleton';
import { useAuth } from '@/context/auth-context';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import { getLatestWatchedSeriesId } from '@/utils/watched-service';

const { width } = Dimensions.get('window');
const POSTER_WIDTH = 115;
const POSTER_HEIGHT = 170;

export function BecauseYouWatched() {
    const [loading, setLoading] = useState(true);
    const [sourceSeries, setSourceSeries] = useState<any>(null);
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const router = useRouter();
    const { currentUser, globalPosters } = useAuth();

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser) {
                setLoading(false);
                return;
            }

            try {
                const latestId = await getLatestWatchedSeriesId(currentUser.uid);
                if (!latestId) {
                    setLoading(false);
                    return;
                }

                const details = await tmdbApi.getSeriesDetails(latestId);
                if (!details) {
                    setLoading(false);
                    return;
                }
                setSourceSeries(details);

                // Analyze for matching
                const sourceGenres = details.genres?.map((g: any) => g.id) || [];
                const sourceKeywords = details.keywords?.results?.map((k: any) => k.name.toLowerCase()) || [];
                const sourcePlot = (details.overview || "").toLowerCase();

                // Fetch recommendations and similar to get a large pool
                const [recsList, similarList] = await Promise.all([
                    tmdbApi.getRecommendations(latestId),
                    tmdbApi.getSimilarSeries(latestId)
                ]);

                // Merge and deduplicate
                const pool = [...(recsList || []), ...(similarList || [])];
                const uniquePool = Array.from(new Map(pool.map(item => [item.id, item])).values());
                // .filter(item => item.id !== latestId); // User requested to SHOW even if watched/same

                // Deep Analysis & Sorting
                const scoredPool = uniquePool.map(item => {
                    let score = 0;

                    // 1. Genre Match
                    const itemGenres = item.genre_ids || [];
                    const genreMatches = itemGenres.filter((id: number) => sourceGenres.includes(id)).length;
                    score += genreMatches * 10;

                    // 2. Plot/Mood matching (Simplified string contains check for keywords)
                    const itemOverview = (item.overview || "").toLowerCase();
                    sourceKeywords.forEach((word: string) => {
                        if (itemOverview.includes(word)) score += 5;
                    });

                    // 3. Narrative Similarity (Checking for common plot tropes in overview)
                    if (sourcePlot.length > 50 && itemOverview.length > 50) {
                        const commonWords = ['murder', 'conspiracy', 'magic', 'space', 'family', 'revenge', 'survival', 'love'];
                        commonWords.forEach((word: string) => {
                            if (sourcePlot.includes(word) && itemOverview.includes(word)) score += 8;
                        });
                    }

                    return { ...item, matchScore: score };
                });

                // Sort by score and take top 20
                const finalRecs = scoredPool
                    .sort((a, b) => b.matchScore - a.matchScore)
                    .slice(0, 20);

                setRecommendations(finalRecs);
            } catch (error) {
                console.error('[BecauseYouWatched] Error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser]);

    const renderItem = ({ item }: { item: any }) => {
        const resolvedPoster = getResolvedPosterUrl(item.id, item.poster_path, globalPosters);

        return (
            <Pressable
                style={({ pressed }) => [
                    styles.card,
                    { transform: [{ scale: pressed ? 0.98 : 1 }] }
                ]}
                onPress={() => router.push(`/(tabs)/series/${item.id}`)}
            >
                <View style={styles.posterWrapper}>
                    <Image
                        source={{ uri: resolvedPoster ?? undefined }}
                        style={styles.poster}
                        contentFit="cover"
                        transition={500}
                    />
                </View>
            </Pressable>
        );
    };

    if (!loading && recommendations.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.subtitle}>BECAUSE YOU WATCHED {sourceSeries?.name?.toUpperCase()}</Text>
                <Text style={styles.title}>Recommended For You</Text>
            </View>

            {loading ? (
                <View style={styles.loadingRow}>
                    {[1, 2, 3].map(i => (
                        <View key={i} style={styles.skeletonWrapper}>
                            <Skeleton width={POSTER_WIDTH} height={POSTER_HEIGHT} borderRadius={6} />
                        </View>
                    ))}
                </View>
            ) : (
                <FlatList
                    data={recommendations}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollContent, { gap: 12 }]}
                    decelerationRate="normal"
                    // Progressive Loading Optimization
                    initialNumToRender={5}
                    maxToRenderPerBatch={5}
                    windowSize={5}
                    scrollEventThrottle={16}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 40,
        backgroundColor: '#000',
    },
    header: {
        paddingHorizontal: 16,
        marginBottom: 15,
    },
    subtitle: {
        color: '#666',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 4,
    },
    title: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 10,
    },
    loadingRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
    },
    skeletonWrapper: {
        marginRight: 12,
    },
    card: {
        width: POSTER_WIDTH,
    },
    posterWrapper: {
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    poster: {
        flex: 1,
    },
});
