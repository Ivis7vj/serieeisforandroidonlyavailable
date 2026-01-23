import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { getUpNextData, UpNextItem } from '@/utils/up-next-service';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import { triggerImpact, triggerSelection } from '@/utils/haptics';
import * as watchedService from '@/utils/watched-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronRight } from 'lucide-react-native';

const HIDDEN_KEY = '@up_next_hidden_ids';

export default function UpNextScreen() {
    const { currentUser, globalPosters } = useAuth();
    const router = useRouter();
    const [items, setItems] = useState<UpNextItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [hiddenIds, setHiddenIds] = useState<number[]>([]);

    const fetchData = async () => {
        if (!currentUser) return;
        try {
            setLoading(true);
            const [data, hiddenJson] = await Promise.all([
                getUpNextData(currentUser.uid),
                AsyncStorage.getItem(HIDDEN_KEY)
            ]);

            const hidden = hiddenJson ? JSON.parse(hiddenJson) : [];
            setHiddenIds(hidden);

            // Filter out hidden items
            setItems(data.filter(item => !hidden.includes(item.tmdbId)));
        } catch (error) {
            console.error('[UpNextScreen] Fetch Error:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [currentUser])
    );

    const handleHide = async (tmdbId: number) => {
        try {
            const newHidden = [...hiddenIds, tmdbId];
            setHiddenIds(newHidden);
            await AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify(newHidden));
            setItems(prev => prev.filter(i => i.tmdbId !== tmdbId));
        } catch (e) {
            console.error('Failed to hide item', e);
        }
    };

    const handleMarkSeasonWatched = async (item: UpNextItem) => {
        if (!currentUser) return;
        try {
            // We need episode count for the season. 
            // the UpNextItem has nextSeasonNumber. 
            // In a real app we might want to fetch exact count, 
            // but for now let's assume we can mark it.
            // Actually watchedService.markSeasonWatched needs episodeCount.
            // I'll show a loading or something, or just fetch it.

            const success = await watchedService.markSeasonWatched(
                currentUser.uid,
                item.tmdbId,
                item.nextSeasonNumber,
                item.totalEpisodesInSeason
            );
            if (success) {
                // Refresh data
                fetchData();
            }
        } catch (e) {
            console.error('Failed to mark season watched', e);
        }
    };

    const handleLongPress = (item: UpNextItem) => {
        triggerImpact();
        Alert.alert(
            item.seriesName,
            'Manage this series',
            [
                { text: 'Mark season watched', onPress: () => handleMarkSeasonWatched(item) },
                { text: 'Remove from Up Next', onPress: () => handleHide(item.tmdbId), style: 'destructive' },
                { text: 'Cancel', style: 'cancel' }
            ]
        );
    };

    const renderItem = ({ item }: { item: UpNextItem }) => {
        const backdropUrl = item.backdropPath
            ? `https://image.tmdb.org/t/p/w500${item.backdropPath}`
            : undefined;

        return (
            <Pressable
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
                onLongPress={() => handleLongPress(item)}
            >
                <Image
                    source={{ uri: backdropUrl }}
                    style={styles.poster}
                    contentFit="cover"
                />
                <View style={styles.info}>
                    <Text style={styles.seriesName} numberOfLines={1}>{item.seriesName}</Text>
                    <Text style={styles.episodeMeta}>
                        Season {item.nextSeasonNumber} • Episode {item.nextEpisodeNumber}
                    </Text>
                    <Text style={styles.lastWatched}>
                        Last watched: S{item.lastWatchedSeason}E{item.lastWatchedEpisode}
                    </Text>
                </View>
                <ChevronRight size={20} color="#333" />
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#FFCC00" />
                </View>
            ) : items.length === 0 ? (
                <View style={styles.center}>
                    <Text style={styles.emptyText}>Nothing up next.</Text>
                    <Text style={styles.emptySub}>Watch something to see it here!</Text>
                </View>
            ) : (
                <FlatList
                    data={items}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.tmdbId.toString()}
                    contentContainerStyle={styles.listContent}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    listContent: {
        paddingVertical: 10,
        paddingBottom: 100,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    poster: {
        width: 120,
        height: (120 * 9) / 16,
        borderRadius: 8,
        backgroundColor: '#111',
    },
    info: {
        flex: 1,
        marginLeft: 15,
        gap: 1,
    },
    seriesName: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
    },
    episodeMeta: {
        color: '#9A9A9A',
        fontSize: 14,
        fontWeight: '500',
    },
    lastWatched: {
        color: '#666',
        fontSize: 12,
        fontWeight: '500',
    },
    emptyText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 20,
    },
    emptySub: {
        color: '#666',
        fontSize: 16,
        marginTop: 8,
    },
});
