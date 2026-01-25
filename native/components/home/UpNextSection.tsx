import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/auth-context';
import { getUpNextData, UpNextItem } from '@/utils/up-next-service';
import Skeleton from '@/components/skeleton';
import { triggerSelection } from '@/utils/haptics';
import { ChevronRight, Layout } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { UpNextWidgetSync } from '@/src/services/UpNextWidgetSync';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.85;
const CARD_HEIGHT = 90; // Balanced height for 16:9 + text
const POSTER_WIDTH = (CARD_HEIGHT * 16) / 9;
const CARD_GAP = 12;

interface UpNextSectionProps {
}

export function UpNextSection({ }: UpNextSectionProps) {
    const [items, setItems] = useState<UpNextItem[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { currentUser } = useAuth();



    useEffect(() => {
        let isMounted = true;

        const fetchUpNext = async () => {
            if (!currentUser) {
                if (isMounted) setLoading(false);
                return;
            }
            try {
                const data = await getUpNextData(currentUser.uid);
                if (isMounted) setItems(data);

                // ⚡ NATIVE WIDGET SYNC LOGIC ⚡
                // Take top 5 items for the widget loop
                const widgetItems = data.slice(0, 5).map(item => ({
                    seriesName: item.seriesName,
                    episodeInfo: `S${item.nextSeasonNumber} • EP${item.nextEpisodeNumber}`,
                    backdropUri: item.backdropPath ? `https://image.tmdb.org/t/p/w500${item.backdropPath}` : '',
                    seriesId: item.tmdbId,
                    seasonNumber: item.nextSeasonNumber,
                    episodeNumber: item.nextEpisodeNumber
                }));

                // Call Native Module directly with list
                UpNextWidgetSync.updateWidgetData(widgetItems);

            } catch (error) {
                console.error('Failed to fetch Up Next:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchUpNext();

        // Realtime Subscription
        const channel = supabase
            .channel(`watched_updates_${currentUser?.uid}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'watched_episodes', filter: `user_id=eq.${currentUser?.uid}` }, () => fetchUpNext())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'episode_ratings', filter: `user_id=eq.${currentUser?.uid}` }, () => fetchUpNext())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'episode_reviews', filter: `user_id=eq.${currentUser?.uid}` }, () => fetchUpNext())
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [currentUser]);

    if (!loading && items.length === 0) return null;

    return (
        <View style={styles.section}>
            <View style={styles.header}>
                <Text style={styles.title}>Up Next</Text>
                <Pressable
                    onPress={() => {
                        triggerSelection();
                        router.push('/(tabs)/up-next');
                    }}
                    hitSlop={15}
                >
                    <ChevronRight color="#FFF" size={24} />
                </Pressable>
            </View>

            {loading ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {[1, 2].map(i => (
                        <View key={i} style={[styles.card, { backgroundColor: '#111' }]}>
                            <Skeleton width={POSTER_WIDTH} height={CARD_HEIGHT} borderRadius={12} />
                            <View style={styles.infoSkeleton}>
                                <Skeleton width={120} height={16} borderRadius={4} />
                                <Skeleton width={80} height={14} borderRadius={4} />
                            </View>
                        </View>
                    ))}
                </ScrollView>
            ) : (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    decelerationRate="fast"
                    snapToInterval={CARD_WIDTH + CARD_GAP}
                    snapToAlignment="start"
                    scrollEventThrottle={16}
                >
                    {items.map((item) => {
                        const backdropUrl = item.backdropPath
                            ? `https://image.tmdb.org/t/p/w500${item.backdropPath}`
                            : undefined;

                        return (
                            <Pressable
                                key={item.tmdbId}
                                style={styles.card}
                                onPress={() => {
                                    triggerSelection();
                                    router.push({
                                        pathname: `/(tabs)/series/${item.tmdbId}`,
                                        params: {
                                            seasonNumber: item.nextSeasonNumber,
                                            highlightEpisode: item.nextEpisodeNumber
                                        }
                                    } as any);
                                }}
                            >
                                <View style={styles.posterWrapper}>
                                    <Image
                                        source={{ uri: backdropUrl }}
                                        style={styles.poster}
                                        contentFit="cover"
                                        transition={300}
                                    />
                                    <LinearGradient
                                        colors={['transparent', 'rgba(0,0,0,0.4)']}
                                        start={{ x: 0.5, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={StyleSheet.absoluteFill}
                                    />
                                </View>

                                <View style={styles.info}>
                                    <Text style={styles.seriesName} numberOfLines={1}>
                                        {item.seriesName}
                                    </Text>
                                    <Text style={styles.episodeInfo}>
                                        S{item.nextSeasonNumber} • EP{item.nextEpisodeNumber}
                                    </Text>
                                    <View style={styles.labelContainer}>
                                        <Text style={styles.label}>Up Next</Text>
                                    </View>
                                </View>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        marginBottom: 35,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    title: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
    },
    scrollContent: {
        paddingHorizontal: 20,
        gap: CARD_GAP,
    },
    card: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        flexDirection: 'row',
        backgroundColor: '#111',
        borderRadius: 12,
        overflow: 'hidden',
    },
    posterWrapper: {
        width: POSTER_WIDTH,
        height: CARD_HEIGHT,
        position: 'relative',
    },
    poster: {
        width: '100%',
        height: '100%',
    },
    info: {
        flex: 1,
        paddingHorizontal: 15,
        justifyContent: 'center',
        gap: 2,
    },
    infoSkeleton: {
        flex: 1,
        paddingHorizontal: 15,
        justifyContent: 'center',
        gap: 8,
    },
    seriesName: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    episodeInfo: {
        color: '#9A9A9A',
        fontSize: 14,
        fontWeight: '500',
    },
    labelContainer: {
        marginTop: 4,
    },
    label: {
        color: '#666',
        fontSize: 11,
        fontWeight: '500',
        textTransform: 'uppercase',
    },
});
