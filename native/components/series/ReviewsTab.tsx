import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import ReviewItem from './ReviewItem';
import { reviewEvents } from '@/utils/review-events'; // Import globally

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Review {
    id: string;
    userId: string;
    userName: string;
    photoURL?: string;
    rating?: number;
    review?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    isEpisode?: boolean;
    isSeason?: boolean;
    likes?: string[];
    tmdbId?: number; // Ensure interface knows about this
}

interface ReviewsTabProps {
    reviews: Review[];
    currentUser?: any;
    userData?: any;
    selectedSeason: number;
    seriesId: string;
}

const ReviewsTab: React.FC<ReviewsTabProps> = ({ reviews, currentUser, userData, selectedSeason, seriesId }) => {
    const router = useRouter();
    const [filter, setFilter] = useState<'public' | 'friends' | 'you'>('public');

    // LOCAL STATE FOR REALTIME UPDATES
    const [internalReviews, setInternalReviews] = useState<Review[]>(reviews);

    // 1. Sync with Parent Props (Source of Truth)
    useEffect(() => {
        setInternalReviews(reviews);
    }, [reviews]);

    // 2. Global Event Listener (Immediate Feedback)
    useEffect(() => {
        const onReviewChange = ({ type, data }: { type: string, data: any }) => {
            // Filter by Series ID (Loose equality for string/number match)
            if (data.tmdbId && String(data.tmdbId) !== String(seriesId)) return;

            console.log(`[ReviewsTab] Realtime Update: ${type}`, data.id);

            setInternalReviews(prev => {
                let next = [...prev];

                if (type === 'create') {
                    // Check if already exists to prevent dupes
                    if (!next.some(r => r.id === data.id)) {
                        next = [data, ...next];
                    }
                } else if (type === 'update') {
                    next = next.map(r =>
                        (r.id === data.id || (
                            r.userId === data.userId &&
                            Number(r.seasonNumber) === Number(data.seasonNumber) &&
                            Number(r.episodeNumber || 0) === Number(data.episodeNumber || 0)
                        )) ? { ...r, ...data } : r
                    );
                } else if (type === 'delete') {
                    next = next.filter(r =>
                        r.id !== data.id &&
                        !(r.userId === currentUser?.uid &&
                            Number(r.seasonNumber) === Number(data.seasonNumber) &&
                            Number(r.episodeNumber || 0) === Number(data.episodeNumber || 0))
                    );
                }
                return next;
            });
        };

        reviewEvents.on('review_change', onReviewChange);
        return () => {
            reviewEvents.off('review_change', onReviewChange);
        };
    }, [seriesId, currentUser, selectedSeason]);

    const changeFilter = (newFilter: 'public' | 'friends' | 'you') => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setFilter(newFilter);
    };

    // 2. Categorize reviews (Use internalReviews instead of props.reviews)
    const isThisSeason = (r: any) =>
        Number(r.seasonNumber) === Number(selectedSeason) ||
        Number(r.seasonNumber) === 0 ||
        r.seasonNumber === null;

    // PUBLIC: Strictly season-specific OR Series level
    const publicReviews = internalReviews.filter(r =>
        isThisSeason(r) &&
        r.userId !== currentUser?.uid &&
        !userData?.following?.includes(r.userId)
    );

    // FRIENDS & YOU: Strictly season-specific OR Series level
    const friendsReviews = internalReviews.filter(r =>
        isThisSeason(r) &&
        userData?.following?.includes(r.userId) &&
        r.userId !== currentUser?.uid
    );
    const youReviews = internalReviews.filter(r =>
        r.userId === currentUser?.uid &&
        isThisSeason(r)
    );

    // 3. Filter for current display
    const displayedReviews = (filter === 'public' ? publicReviews : filter === 'friends' ? friendsReviews : youReviews).map(r => {
        // Fix for "YOU" section: Use real username if it's me
        if (r.userId === currentUser?.uid && userData?.username) {
            return { ...r, userName: userData.username };
        }
        return r;
    });

    const limitedReviews = displayedReviews.slice(0, 10);

    const showViewMore = displayedReviews.length > 10;

    // Helper: Render Stars (Passed to item)
    const renderStars = (rating: number, size: number = 12) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            const isFull = rating >= i;
            const isHalf = rating >= i - 0.5 && rating < i;

            stars.push(
                <View key={i} style={{ position: 'relative' }}>
                    <FontAwesome
                        name={isFull ? "star" : (isHalf ? "star-half-full" : "star-o")}
                        size={size}
                        color={isFull || isHalf ? "#FFD600" : "#333"}
                    />
                </View>
            );
        }
        return <View style={{ flexDirection: 'row', gap: 2 }}>{stars}</View>;
    };

    return (
        <View style={styles.container}>
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

            {/* REVIEWS LIST */}
            <View style={styles.listContainer}>
                {limitedReviews.length === 0 ? (
                    <Text style={styles.emptyText}>No reviews found.</Text>
                ) : (
                    <>
                        {limitedReviews.map((review: Review) => (
                            <ReviewItem
                                key={review.id}
                                review={review}
                                renderStars={renderStars}
                                isMe={review.userId === currentUser?.uid}
                            />
                        ))}
                        {showViewMore && (
                            <Pressable
                                style={styles.viewMoreBtn}
                                onPress={() => {
                                    router.push({
                                        pathname: '/series-reviews',
                                        params: {
                                            id: seriesId,
                                            seasonNumber: selectedSeason,
                                            filter: filter
                                        }
                                    } as any);
                                }}
                            >
                                <Text style={styles.viewMoreText}>VIEW MORE</Text>
                            </Pressable>
                        )}
                    </>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingTop: 20,
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: '#1a1a1a',
        borderRadius: 8,
        padding: 4,
        marginBottom: 20,
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
    listContainer: {
        gap: 16,
        paddingBottom: 20, // Reduced from 80
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        marginTop: 20,
    },
    viewMoreBtn: {
        alignItems: 'center',
        paddingVertical: 15,
        marginTop: 40,
    },
    viewMoreText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1,
    }
});

export default ReviewsTab;
