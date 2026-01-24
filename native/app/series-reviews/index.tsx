import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
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
    const { id, seasonNumber, episodeNumber } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser, userData } = useAuth();

    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState<any>(null);

    const isEpisode = !!episodeNumber;
    const isSeason = !!seasonNumber && !episodeNumber;
    const isSeries = !seasonNumber && !episodeNumber;

    const [filter, setFilter] = useState<'public' | 'friends' | 'you'>('public');

    const changeFilter = (newFilter: 'public' | 'friends' | 'you') => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setFilter(newFilter);
    };

    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const numericId = parseInt(id as string);
                const numericSeason = seasonNumber ? parseInt(seasonNumber as string) : null;
                const numericEpisode = episodeNumber ? parseInt(episodeNumber as string) : null;

                // Sync fetches
                const detailsPromise = tmdbApi.getSeriesDetails(numericId);
                let reviewsPromise;

                if (isEpisode) {
                    reviewsPromise = reviewService.getEpisodeReviews(numericId, numericSeason!, numericEpisode!);
                } else if (isSeason) {
                    reviewsPromise = reviewService.getSeasonReviews(numericId, numericSeason!);
                } else {
                    reviewsPromise = reviewService.getSeriesReviews(numericId);
                }

                const [seriesDetails, fetchedReviews] = await Promise.all([detailsPromise, reviewsPromise]);
                setDetails(seriesDetails);

                // Filter for context if we are in a season/episode view
                let finalReviews = fetchedReviews;
                if (isSeason) {
                    finalReviews = fetchedReviews.filter((r: any) => !r.seasonNumber || Number(r.seasonNumber) === numericSeason);
                } else if (isEpisode) {
                    finalReviews = fetchedReviews.filter((r: any) =>
                        (!r.seasonNumber && !r.episodeNumber) ||
                        (Number(r.seasonNumber) === numericSeason && Number(r.episodeNumber) === numericEpisode)
                    );
                }

                setReviews(finalReviews.sort((a: any, b: any) => {
                    const amIAuthor = a.userId === currentUser?.uid;
                    const bmIAuthor = b.userId === currentUser?.uid;
                    if (amIAuthor && !bmIAuthor) return -1;
                    if (!amIAuthor && bmIAuthor) return 1;

                    // Secondary sort: Likes
                    const aLikes = a.likes?.length || 0;
                    const bLikes = b.likes?.length || 0;
                    if (aLikes !== bLikes) return bLikes - aLikes;

                    // Tertiary sort: Newest first (Force newest)
                    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return bDate - aDate;
                }));
            } catch (error) {
                console.error("Error fetching reviews:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, seasonNumber, episodeNumber]);

    // Filtering logic (Synchronized with ReviewsTab.tsx)
    const displayedReviews = reviews.filter(r => {
        const isMe = r.userId === currentUser?.uid;
        const isFollowing = userData?.following?.includes(r.userId);

        if (filter === 'public') {
            // PUBLIC: Keep strict context (Season or Episode)
            const matchesSeason = Number(r.seasonNumber) === Number(seasonNumber);
            const matchesEpisode = isEpisode ? Number(r.episodeNumber) === Number(episodeNumber) : true;
            return !isMe && !isFollowing && matchesSeason && matchesEpisode;
        } else if (filter === 'friends') {
            // FRIENDS: Show all activity for the series
            return isFollowing && !isMe;
        } else {
            // YOU: Show all your activity for the series
            return isMe;
        }
    }).map(r => {
        // Fix for "YOU" section
        if (r.userId === currentUser?.uid && userData?.username) {
            return { ...r, userName: userData.username };
        }
        return r;
    });

    const handleDelete = (review: any) => {
        Alert.alert(
            "Delete Review?",
            "Are you sure you want to delete this review?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            if (review.isEpisode) {
                                await reviewService.deleteEpisodeReview(review.id);
                            } else {
                                await reviewService.deleteSeasonReview(review.id);
                            }
                            setReviews(prev => prev.filter(r => r.id !== review.id));
                            triggerImpact();
                        } catch (e) {
                            Alert.alert("Error", "Failed to delete review");
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFCC00" />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            {/* Header */}
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

                    {/* Absolute Center Logo */}
                </View>
            </View>

            {/* SUB-TABS (3 Sections) */}
            <View style={styles.segmentContainer}>
                <Pressable
                    style={[styles.segmentBtn, filter === 'public' && styles.segmentBtnActive]}
                    onPress={() => changeFilter('public')}
                >
                    <Text style={[styles.segmentText, filter === 'public' && styles.segmentTextActive]}>PUBLIC</Text>
                </Pressable>
                <Pressable
                    style={[styles.segmentBtn, filter === 'friends' && styles.segmentBtnActive]}
                    onPress={() => changeFilter('friends')}
                >
                    <Text style={[styles.segmentText, filter === 'friends' && styles.segmentTextActive]}>FRIENDS</Text>
                </Pressable>
                <Pressable
                    style={[styles.segmentBtn, filter === 'you' && styles.segmentBtnActive]}
                    onPress={() => changeFilter('you')}
                >
                    <Text style={[styles.segmentText, filter === 'you' && styles.segmentTextActive]}>YOU</Text>
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                {displayedReviews.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MessageCircle size={60} color="#222" />
                        <Text style={styles.emptyText}>No reviews found in this section.</Text>
                    </View>
                ) : (
                    displayedReviews.map((review: any) => (
                        <ReviewItem
                            key={review.id}
                            review={review}
                            renderStars={(rating, size) => {
                                // Inline helper since ReviewItem expects it
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
                            isMe={review.userId === currentUser?.uid}
                        />
                    ))
                )}
            </ScrollView>
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
    loadingText: {
        color: '#AAA',
        marginTop: 15,
        fontSize: 14
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
        position: 'relative',
        height: '100%',
    },
    titleGroup: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
        zIndex: 5,
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
    iconBtn: {
        padding: 5
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
