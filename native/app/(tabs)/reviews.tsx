import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/utils/supabase';

import { Star, MessageSquare, Heart } from 'lucide-react-native';
import { getTMDBImageUrl, getResolvedPosterUrl } from '@/utils/poster-resolver';
import * as reviewService from '@/utils/review-service';
import { tmdbApi } from '@/utils/tmdb';
import { triggerSelection, triggerImpact } from '@/utils/haptics';
import ReviewDrawer from '@/components/review/ReviewDrawer';
import * as likeService from '@/utils/likes-service';

const { width } = Dimensions.get('window');

interface ReviewItem {
    id: string;
    tmdbId: number;
    seasonNumber: number;
    episodeNumber?: number;
    review: string;
    rating: string;
    name: string;
    poster_path: string;
    createdAt: string;
    [key: string]: any;
}

export default function ReviewsScreen() {
    const { currentUser, globalPosters } = useAuth();
    const router = useRouter();
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [years, setYears] = useState<Record<number, string>>({});
    const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    // Local Drawer State
    const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
    const [drawerVisible, setDrawerVisible] = useState(false);

    const fetchReviews = async () => {
        if (!currentUser) return;
        try {
            setLoading(true);
            const [data, likes] = await Promise.all([
                reviewService.getUserReviews(currentUser.uid),
                likeService.getUserLikes(currentUser.uid)
            ]);

            setReviews(data || []);
            setUserLikes(new Set(likes.map(l => l.id)));

            // Fetch missing years
            const uniqueIds = Array.from(new Set(data.map(r => r.tmdbId)));
            const yearResults: Record<number, string> = {};
            await Promise.all(uniqueIds.map(async (id) => {
                try {
                    const details = await tmdbApi.getSeriesDetails(id);
                    if (details?.first_air_date) {
                        yearResults[id] = new Date(details.first_air_date).getFullYear().toString();
                    }
                } catch (e) {
                    console.error("Year fetch failed for", id);
                }
            }));
            setYears(yearResults);
        } catch (error) {
            console.error('[ReviewsScreen] Fetch Error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, [currentUser]);

    const renderStars = (rating: number) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            const isFull = rating >= i;
            const isHalf = rating >= i - 0.5 && rating < i;
            if (isFull) {
                stars.push(<Star key={i} size={14} color="#FFCC00" fill="#FFCC00" />);
            } else if (isHalf) {
                stars.push(
                    <View key={i} style={{ position: 'relative' }}>
                        <Star size={14} color="#FFCC00" strokeWidth={2} />
                        <View style={{ position: 'absolute', top: 0, left: 0, width: 7, overflow: 'hidden' }}>
                            <Star size={14} color="#FFCC00" fill="#FFCC00" strokeWidth={2} />
                        </View>
                    </View>
                );
            } else {
                stars.push(<Star key={i} size={14} color="#333" strokeWidth={2} />);
            }
        }
        return <View style={{ flexDirection: 'row', gap: 2 }}>{stars}</View>;
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const renderReviewItem = ({ item }: { item: ReviewItem & { seriesId?: number } }) => {
        // Construct unique ID for likes matching like-service logic
        let likeId = String(item.tmdbId);
        if (item.isSeason) likeId += `-S${item.seasonNumber}`;
        if (item.isEpisode) likeId += `-S${item.seasonNumber}E${item.episodeNumber}`;
        const isLiked = userLikes.has(likeId);

        const isHorizontal = !!item.episodeNumber;

        // Custom Poster Logic: Always use Season Poster for 2:3 standardization
        const posterUrl = getResolvedPosterUrl(
            (item.isEpisode && item.seriesId) ? item.seriesId : item.tmdbId,
            item.poster_path,
            globalPosters,
            'w500',
            item.seasonNumber,
            false
        );

        const handlePress = () => {
            triggerSelection();
            setSelectedReview(item);
            setDrawerVisible(true);
        };

        return (
            <Pressable
                style={styles.reviewCard}
                onPress={handlePress}
            >
                <View style={styles.headerRow}>
                    <Text style={styles.seriesTitle}>{item.name}</Text>
                </View>

                <View style={styles.ratingRow}>
                    {isHorizontal ? (
                        <View style={styles.condensedRating}>
                            <Text style={styles.epBadge}>S{item.seasonNumber} E{item.episodeNumber}</Text>
                            <Star size={14} color="#FFD600" fill="#FFD600" />
                            <Text style={styles.ratingTextCondensed}>{parseFloat(item.rating).toFixed(1)}</Text>
                        </View>
                    ) : (
                        renderStars(parseFloat(item.rating || '0'))
                    )}
                    {isLiked && <Heart size={14} color="#FFCC00" fill="#FFCC00" />}
                </View>

                <View style={styles.contentRow}>
                    <Image
                        source={{ uri: posterUrl ?? undefined }}
                        style={styles.poster}
                        contentFit="cover"
                    />
                    <View style={styles.textContainer}>
                        <Text style={styles.reviewBody} numberOfLines={isHorizontal ? 3 : 6}>
                            {item.review}
                        </Text>
                        <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.main}>
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color="#FFCC00" />
                    </View>
                ) : reviews.length === 0 ? (
                    <View style={styles.center}>
                        <MessageSquare size={64} color="#333" />
                        <Text style={styles.emptyText}>No reviews yet.</Text>
                        <Text style={styles.emptySub}>Start watching and reviewing episodes!</Text>
                    </View>
                ) : (
                    <FlatList
                        data={[
                            ...(reviews.filter(r => r.isSeason).length > 0 ? [{ id: 'header-seasons', isHeader: true, title: 'Season Reviews' }] : []),
                            ...reviews.filter(r => r.isSeason),
                            ...(reviews.filter(r => r.isEpisode).length > 0 ? [{ id: 'header-episodes', isHeader: true, title: 'Episode Reviews' }] : []),
                            ...reviews.filter(r => r.isEpisode)
                        ]}
                        renderItem={({ item }: any) => {
                            if (item.isHeader) {
                                return <Text style={styles.sectionHeader}>{item.title}</Text>;
                            }
                            return renderReviewItem({ item });
                        }}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        extraData={globalPosters}
                    />
                )}
            </View>

            <ReviewDrawer
                visible={drawerVisible}
                onClose={() => {
                    setDrawerVisible(false);
                    setSelectedReview(null);
                }}
                reviewData={selectedReview}
                onReviewChanged={fetchReviews}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    main: {
        flex: 1,
    },
    sectionHeader: {
        color: '#FFCC00',
        fontSize: 16,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 24,
        marginBottom: 16,
        borderLeftWidth: 3,
        borderLeftColor: '#FFCC00',
        paddingLeft: 10,
        marginHorizontal: 20,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingTop: 10,
        paddingBottom: 120, // Increased bottom space
    },
    reviewCard: {
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#000',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerRow: {
        marginBottom: 4,
    },
    seriesTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: -0.2,
    },
    yearText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '400',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    epBadge: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    condensedRating: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    ratingTextCondensed: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    contentRow: {
        flexDirection: 'row',
        gap: 15,
        alignItems: 'flex-start',
    },
    poster: {
        width: 70,
        height: 105,
        borderRadius: 4,
        backgroundColor: '#111',
    },
    textContainer: {
        flex: 1,
        justifyContent: 'space-between',
    },
    reviewBody: {
        color: '#FFF',
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '400',
    },
    dateText: {
        color: '#666',
        fontSize: 12,
        marginTop: 10,
        fontWeight: '500',
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 20,
    },
    emptySub: {
        color: '#333',
        fontSize: 14,
        marginTop: 8,
    }
});
