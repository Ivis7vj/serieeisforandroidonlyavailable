import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    FlatList,
    Pressable,
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    UIManager,
    LayoutAnimation
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Star, Edit3, Trash2, MessageCircle, User } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

import { useAuth } from '@/context/auth-context';
import * as reviewService from '@/utils/review-service';
import { tmdbApi } from '@/utils/tmdb';
import { triggerSelection, triggerImpact } from '@/utils/haptics';
import ReviewItem from '@/components/series/ReviewItem';

const { width } = Dimensions.get('window');

export default function SeriesReviewsListingScreen() {
    const { id, seasonNumber, filter: initialFilter } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser, userData } = useAuth();

    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [cursor, setCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [details, setDetails] = useState<any>(null);

    const [filter, setFilter] = useState<'public' | 'friends' | 'you'>((initialFilter as any) || 'public');

    const changeFilter = (newFilter: 'public' | 'friends' | 'you') => {
        if (newFilter === filter) return;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setFilter(newFilter);
        // Effect will handle reload
    };

    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    // Load Data Effect
    useEffect(() => {
        // Reset State for new fetch
        setReviews([]);
        setCursor(null);
        setHasMore(true);
        loadReviews(false, filter);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, id, seasonNumber]);

    const loadReviews = async (isNextPage: boolean, currentFilter: string) => {
        if (isNextPage && (!hasMore || loadingMore)) return;

        if (isNextPage) setLoadingMore(true);
        else setLoading(true);

        try {
            const numericId = parseInt(id as string);
            const numericSeason = parseInt(seasonNumber as string);

            // Fetch Details Once
            if (!details && !isNextPage) {
                tmdbApi.getSeriesDetails(numericId).then(setDetails);
            }

            // Filtering Logic for Service
            let includeIds: string[] | undefined;
            let excludeIds: string[] | undefined;

            if (currentFilter === 'friends') {
                if (!userData?.following || userData.following.length === 0) {
                    // No friends? return empty immediately
                    setReviews([]); setLoading(false); setLoadingMore(false); setHasMore(false); return;
                }
                includeIds = userData.following;
            } else if (currentFilter === 'you') {
                if (!currentUser) { setReviews([]); setLoading(false); return; }
                includeIds = [currentUser.uid];
            } else {
                // Public: Exclude Me AND Friends to keep sections distinct
                if (currentUser) {
                    const friends = userData?.following || [];
                    excludeIds = [currentUser.uid, ...friends];
                }
            }

            const activeCursor = isNextPage ? cursor : undefined;

            const { data, nextCursor } = await reviewService.getPaginatedSeasonReviews(
                numericId,
                numericSeason,
                10,
                activeCursor as any,
                includeIds,
                excludeIds
            );

            if (isNextPage) {
                setReviews(prev => [...prev, ...data]);
            } else {
                setReviews(data);
            }

            setCursor(nextCursor);
            setHasMore(!!nextCursor);

        } catch (error) {
            console.error("Error fetching reviews:", error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <Pressable onPress={() => { triggerSelection(); router.back(); }} style={styles.backBtn}>
                <ArrowLeft color="#FFF" size={28} />
            </Pressable>

            <View style={styles.headerContent}>
                <View style={styles.titleGroup}>
                    <Text style={styles.headerTitle}>Reviews</Text>
                    {details?.name && (
                        <Text style={styles.headerSubtitle} numberOfLines={1}>
                            {details.name} {seasonNumber && `• S${seasonNumber}`}
                        </Text>
                    )}
                </View>
            </View>
        </View>
    );

    const renderTabs = () => (
        <View style={styles.segmentContainer}>
            {['public', 'friends', 'you'].map((key) => (
                <Pressable
                    key={key}
                    style={[styles.segmentBtn, filter === key && styles.segmentBtnActive]}
                    onPress={() => changeFilter(key as any)}
                >
                    <Text style={[styles.segmentText, filter === key && styles.segmentTextActive]}>
                        {key.toUpperCase()}
                    </Text>
                </Pressable>
            ))}
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {renderHeader()}
            {renderTabs()}

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FFCC00" />
                </View>
            ) : (
                <FlatList
                    data={reviews}
                    keyExtractor={(item: any) => item.id}
                    renderItem={({ item }: { item: any }) => (
                        <ReviewItem
                            review={item}
                            renderStars={(rating, size) => {
                                const stars = [];
                                for (let i = 1; i <= 5; i++) {
                                    const isFull = rating >= i;
                                    const isHalf = rating >= i - 0.5 && rating < i;
                                    stars.push(
                                        <View key={i} style={{ position: 'relative' }}>
                                            <Star size={size} color={isFull || isHalf ? "#FFD600" : "#333"} fill={isFull ? "#FFD600" : "transparent"} strokeWidth={2} />
                                            {isHalf && (
                                                <View style={{ position: 'absolute', top: 0, left: 0, width: size / 2, overflow: 'hidden' }}>
                                                    <Star size={size} color="#FFD600" fill="#FFD600" strokeWidth={2} />
                                                </View>
                                            )}
                                        </View>
                                    );
                                }
                                return <View style={{ flexDirection: 'row', gap: 2 }}>{stars}</View>;
                            }}
                            isMe={item.userId === currentUser?.uid}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    onEndReached={() => loadReviews(true, filter)}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        loadingMore ? <ActivityIndicator color="#FFCC00" style={{ marginVertical: 20 }} /> : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MessageCircle size={60} color="#222" />
                            <Text style={styles.emptyText}>No reviews found in this section.</Text>
                        </View>
                    }
                    showsVerticalScrollIndicator={false}
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
    loadingContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        height: 56,
        backgroundColor: '#000',
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
    },
    backBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: '100%',
    },
    titleGroup: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        color: '#FFCC00',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: '#1a1a1a',
        borderRadius: 8,
        padding: 4,
        marginHorizontal: 20,
        marginTop: 10,
        marginBottom: 10,
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    segmentBtnActive: {
        backgroundColor: '#333',
    },
    segmentText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
    },
    segmentTextActive: {
        color: '#FFF',
    },
    list: {
        padding: 20,
        paddingBottom: 100
    },
    emptyState: {
        alignItems: 'center',
        paddingTop: 100
    },
    emptyText: {
        color: '#666',
        marginTop: 20,
        fontSize: 16
    }
});
