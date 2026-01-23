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
            const fullList = await getWatchlist(currentUser.uid);
            const sid = parseInt(seriesId);
            const sno = parseInt(seasonNumber || '0');

            const basketEpisodes = fullList.filter((item: any) =>
                (item.seriesId === sid || item.id === sid || item.tmdb_id === sid) &&
                item.seasonNumber === sno &&
                item.episodeNumber !== undefined &&
                item.episodeNumber !== null &&
                String(item.episodeNumber).trim() !== ''
            );

            basketEpisodes.sort((a: any, b: any) => a.episodeNumber - b.episodeNumber);
            setEpisodes(basketEpisodes);

            // Fallback name if API fails
            if (!seriesName && basketEpisodes.length > 0) {
                const name = basketEpisodes[0].name.split(' - ')[0]; // Heuristic
                // setSeriesName(name); // Don't overwrite if API is running
            }
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
                        source={{ uri: getTMDBImageUrl(item.still_path || item.poster_path, 'w500') || undefined }}
                        style={styles.stillImage}
                        contentFit="cover"
                    />
                </View>

                {/* Info */}
                <View style={styles.infoContainer}>
                    <Text style={styles.epNumberText}>Episode {item.episodeNumber}</Text>
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
                        <Minus color="#000" size={12} strokeWidth={4} />
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
        paddingHorizontal: 8,
        height: 56,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
        height: '100%',
    },
    headerTitleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        zIndex: 5,
    },
    headerSeriesName: {
        color: 'white',
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    headerSeasonName: {
        color: '#FFCC00', // Yellow for Season number contrast
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    listContent: {
        paddingHorizontal: 0,
        paddingBottom: 40
    },
    cardContainer: {
        flexDirection: 'column', // Stack Image then Text (As per Image: Image top, Text below)
        marginBottom: 24,
        position: 'relative'
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#1a1a1a',
        marginBottom: 8
    },
    stillImage: {
        width: '100%',
        height: '100%'
    },
    infoContainer: {
        paddingRight: 40, // Space for remove button
        paddingHorizontal: 16, // Add some padding for text
    },
    epNumberText: {
        color: '#FFCC00',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2
    },
    epTitleText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
    },
    removeBtn: {
        position: 'absolute',
        bottom: 15, // Align with text area roughly
        right: 0,
        padding: 5
    },
    removeCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FF3B30', // Red
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FF3B30' // Optional border
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        marginTop: 50
    }
});
