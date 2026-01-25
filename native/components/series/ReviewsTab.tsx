import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import ReviewItem from './ReviewItem';

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

    const changeFilter = (newFilter: 'public' | 'friends' | 'you') => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setFilter(newFilter);
    };

    // 2. Categorize reviews
    // PUBLIC: Strictly season-specific
    const publicReviews = reviews.filter(r =>
        Number(r.seasonNumber) === Number(selectedSeason) &&
        r.userId !== currentUser?.uid &&
        !userData?.following?.includes(r.userId)
    );

    // FRIENDS & YOU: Strictly season-specific
    const friendsReviews = reviews.filter(r =>
        userData?.following?.includes(r.userId) &&
        r.userId !== currentUser?.uid &&
        Number(r.seasonNumber) === Number(selectedSeason)
    );
    const youReviews = reviews.filter(r =>
        r.userId === currentUser?.uid &&
        Number(r.seasonNumber) === Number(selectedSeason)
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
