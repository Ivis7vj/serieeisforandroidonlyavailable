import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { tmdbApi } from '@/utils/tmdb';
import Skeleton from '@/components/skeleton';
import { useAuth } from '@/context/auth-context';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';

export function TrendingSection() {
    const [trending, setTrending] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { globalPosters } = useAuth();

    useEffect(() => {
        const fetchTrending = async () => {
            try {
                const data = await tmdbApi.getTrending('day');
                setTrending(data);
            } catch (error) {
                console.error('Failed to fetch trending:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTrending();
    }, []);

    if (!loading && trending.length === 0) return null;

    return (
        <View style={styles.section}>
            <View style={styles.header}>
                <Text style={styles.title}>Trending on Internet</Text>
            </View>

            {loading ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {[1, 2, 3, 4].map(i => (
                        <View key={i} style={styles.skeletonWrapper}>
                            <Skeleton width={115} height={170} borderRadius={6} />
                        </View>
                    ))}
                </ScrollView>
            ) : (
                <ScrollView
                    horizontal
                    // @ts-ignore
                    delaysContentTouches={false}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollContent, { gap: 12 }]}
                    decelerationRate="normal"
                >
                    {trending.map((item) => {
                        const resolvedPoster = getResolvedPosterUrl(item.id, item.poster_path, globalPosters);

                        return (
                            <GHTouchableOpacity
                                key={item.id}
                                activeOpacity={0.7}
                                style={styles.card}
                                onPress={() => router.push(`/(tabs)/series/${item.id}`)}
                            >
                                <View style={styles.posterWrapper}>
                                    <Image
                                        source={{ uri: resolvedPoster ?? undefined }}
                                        style={styles.poster}
                                        contentFit="cover"
                                        transition={300}
                                    />
                                </View>
                            </GHTouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        marginBottom: 30,
    },
    header: {
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    title: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '900',
    },
    scrollContent: {
        paddingHorizontal: 16, // Reduced for closer edge feel
    },
    skeletonWrapper: {
        marginRight: 12,
    },
    card: {
        // width: 115, // Let content define width
    },
    posterWrapper: {
        width: 115,
        height: 170,
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#222',
    },
    poster: {
        width: '100%',
        height: '100%',
    },
});
