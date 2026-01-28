import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ArrowLeft, X, Minus, Trash2, Circle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth-context';
import { getWatchlist, removeFromWatchlist } from '@/utils/watchlist-service';
import { getTMDBImageUrl } from '@/utils/poster-resolver';
import { triggerSelection, triggerNotification } from '@/utils/haptics';
import { tmdbApi } from '@/utils/tmdb';

const { width } = Dimensions.get('window');

// Font fallback
const FONT_HEADER = Platform.OS === 'ios' ? 'Impact' : 'Roboto';
const FONT_CONDENSED = Platform.OS === 'ios' ? 'AvenirNext-CondensedBold' : 'sans-serif-condensed';

export default function WatchlistBasketScreen() {
    const { seriesId, seasonNumber } = useLocalSearchParams<{ seriesId: string, seasonNumber: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser, refreshUserData } = useAuth();
    const [episodes, setEpisodes] = useState<any[]>([]);
    const [seriesName, setSeriesName] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadBasket();
        fetchSeriesInfo();
    }, [seriesId, seasonNumber]);

    const fetchSeriesInfo = async () => {
        try {
            if (seriesId) {
                const data = await tmdbApi.getSeriesDetails(seriesId);
                setSeriesName(data.name || '');
            }
        } catch (e) { console.error(e); }
    };

    const loadBasket = async () => {
        if (!currentUser || !seriesId) return;
        setLoading(true);
        try {
            const sid = parseInt(seriesId);
            const sno = parseInt(seasonNumber || '0');

            // 1. Fetch full season details to get overviews and air dates
            const seasonData = await tmdbApi.getSeasonDetails(sid, sno);
            const tmdbEpisodes = seasonData?.episodes || [];

            // 2. Fetch user's watchlist
            const fullList = await getWatchlist(currentUser.uid);

            const basketEpisodes = fullList.filter((item: any) =>
                (item.seriesId === sid || item.id === sid || item.tmdb_id === sid) &&
                item.seasonNumber === sno &&
                item.episodeNumber !== undefined &&
                item.episodeNumber !== null &&
                String(item.episodeNumber).trim() !== ''
            );

            // 3. Enrich watchlist items with partial TMDB data
            const enriched = basketEpisodes.map((item: any) => {
                const tmdbEp = tmdbEpisodes.find((te: any) => te.episode_number === item.episodeNumber);
                return {
                    ...item,
                    overview: tmdbEp?.overview || '',
                    air_date: tmdbEp?.air_date || '',
                    name: tmdbEp?.name || item.name || `Episode ${item.episodeNumber}`,
                    still_path: tmdbEp?.still_path || item.still_path || item.poster_path
                };
            });

            enriched.sort((a: any, b: any) => a.episodeNumber - b.episodeNumber);
            setEpisodes(enriched);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (itemId: number) => {
        if (!currentUser) return;
        triggerSelection();
        try {
            const updatedEpisodes = episodes.filter(e => (e.tmdb_id !== itemId && e.id !== itemId));
            setEpisodes(updatedEpisodes);

            await removeFromWatchlist(currentUser.uid, itemId);
            triggerNotification();

            // REFRESH AUTH DATA IMMEDIATELY
            await refreshUserData();

            // If this was the last episode in the bucket, remove the season itself
            if (updatedEpisodes.length === 0 && seriesId) {
                // Remove the season item from watchlist (type: 'season')
                // We don't have its specific TMDB ID for seasonal entry here easily, 
                // but we can use removeFromWatchlist if we know it or a bulk remove.
                // Or use removeSeasonFromWatchlist service.
                const { removeSeasonFromWatchlist } = await import('@/utils/watchlist-service');
                await removeSeasonFromWatchlist(currentUser.uid, parseInt(seriesId), parseInt(seasonNumber));
                await refreshUserData();

                // Navigate back if empty
                router.replace('/profile');
            }
        } catch (e) {
            console.error(e);
            loadBasket();
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const date = item.air_date ? new Date(item.air_date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }) : '';

        return (
            <Pressable
                style={styles.cardContainer}
                onPress={() => {
                    router.push({
                        pathname: `/series/${seriesId || item.seriesId}` as any,
                        params: { seasonNumber: seasonNumber }
                    });
                }}
            >
                {/* Still Image */}
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: getTMDBImageUrl(item.still_path, 'w500') || undefined }}
                        style={styles.stillImage}
                        contentFit="cover"
                    />
                    <View style={styles.imgOverlay}>
                        <View style={styles.epBadge}>
                            <Text style={styles.epBadgeText}>E{item.episodeNumber}</Text>
                        </View>
                    </View>
                </View>

                {/* Info Container */}
                <View style={styles.infoContainer}>
                    <View style={styles.infoHeader}>
                        <Text style={styles.epTitleText} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.dateText}>{date}</Text>
                    </View>

                    {item.overview ? (
                        <Text style={styles.overviewText} numberOfLines={3}>
                            {item.overview}
                        </Text>
                    ) : null}
                </View>

                {/* Remove Button */}
                <Pressable
                    style={styles.removeBtn}
                    onPress={(e) => {
                        e.stopPropagation();
                        handleRemove(item.tmdb_id || item.id);
                    }}
                >
                    <View style={styles.removeCircle}>
                        <Minus color="#000" size={14} strokeWidth={4} />
                    </View>
                </Pressable>
            </Pressable>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft color="white" size={28} />
                </Pressable>

                <View style={styles.headerContent}>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerSeriesName} numberOfLines={1}>
                            {seriesName}
                        </Text>
                        <Text style={styles.headerSeasonName}>
                            &nbsp;Season {seasonNumber}
                        </Text>
                    </View>

                    {/* Absolute Center Logo */}
                </View>
            </View>

            <FlatList
                data={episodes}
                renderItem={renderItem}
                keyExtractor={(item, index) => (item.tmdb_id || index).toString()}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    !loading ? <Text style={styles.emptyText}>No items.</Text> : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        height: 80,
        backgroundColor: '#000',
    },
    backBtn: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    headerContent: {
        flex: 1,
        paddingLeft: 10
    },
    headerTitleContainer: {
        gap: 2
    },
    headerSeriesName: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
        opacity: 0.5,
        textTransform: 'uppercase'
    },
    headerSeasonName: {
        color: '#FFCC00',
        fontSize: 22,
        fontWeight: 'bold',
    },
    listContent: {
        paddingBottom: 40
    },
    cardContainer: {
        marginBottom: 30,
        position: 'relative',
        paddingHorizontal: 0
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#111',
        borderRadius: 0,
        overflow: 'hidden',
        marginBottom: 12
    },
    stillImage: {
        width: '100%',
        height: '100%'
    },
    imgOverlay: {
        ...StyleSheet.absoluteFillObject,
        padding: 12,
        justifyContent: 'flex-start',
        alignItems: 'flex-start'
    },
    epBadge: {
        backgroundColor: '#FFCC00',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    epBadgeText: {
        color: '#000',
        fontSize: 12,
        fontWeight: 'bold'
    },
    infoContainer: {
        flex: 1,
        paddingHorizontal: 15,
    },
    infoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6
    },
    epTitleText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 10
    },
    dateText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        fontWeight: 'bold'
    },
    overviewText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        lineHeight: 18,
    },
    removeBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
        padding: 5,
        zIndex: 20
    },
    removeCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5
    },
    emptyText: {
        color: '#444',
        textAlign: 'center',
        marginTop: 100,
        fontSize: 16,
        fontWeight: 'bold'
    }
});
