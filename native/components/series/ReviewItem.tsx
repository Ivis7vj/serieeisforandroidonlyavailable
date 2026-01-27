import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { useAuth } from '@/context/auth-context';
import { AlertTriangle } from 'lucide-react-native';
import { ReportReviewModals } from '../review/ReportReviewModals';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import { tmdbApi } from '@/utils/tmdb';

interface ReviewItemProps {
    review: any;
    renderStars: (rating: number, size: number) => React.ReactNode;
    isMe?: boolean;
    onPress?: () => void;
}

const ReviewItem: React.FC<ReviewItemProps> = ({ review, renderStars, isMe, onPress }) => {
    const router = useRouter();
    const { userData, currentUser } = useAuth();

    // Initialize with passed prop, but allow hydration
    const [photoURL, setPhotoURL] = useState<string | null>(review.photoURL || review.photo_url || null);
    const [username, setUsername] = useState<string>(review.userName || review.user_name || 'User');
    const [seriesName, setSeriesName] = useState<string>(review.seriesName || review.name || review.series_name || 'Show');

    const [reportModalVisible, setReportModalVisible] = useState(false);

    // Hydrate User Data (Fresh Username & Photo)
    useEffect(() => {
        const fetchUserData = async () => {
            if (!review.userId) return;
            try {
                const userDoc = await getDoc(doc(db, 'users', review.userId));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    if (data.photoURL) setPhotoURL(data.photoURL);
                    if (data.username) setUsername(data.username);
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        fetchUserData();
    }, [review.userId]);

    // Hydrate Series Data (Fresh Series Name if missing/borked)
    useEffect(() => {
        const fetchSeriesData = async () => {
            const currentName = review.seriesName || review.name || review.series_name;
            const needsFetch = !currentName || currentName === 'Show' || currentName === 'Series';
            const tmdbId = review.tmdbId || review.tmdb_id;

            if (needsFetch && tmdbId) {
                try {
                    const details = await tmdbApi.getSeriesDetails(tmdbId);
                    if (details && details.name) {
                        setSeriesName(details.name);
                    }
                } catch (error) {
                    console.error("Error fetching series details:", error);
                }
            } else if (currentName) {
                // Ensure state matches prop if prop was good (e.g. recycling cells)
                // Actually, the initial state covers this, but if prop changes this effect might need to reset? 
                // In React Native lists, usually keys handle this, but let's be safe:
                if (currentName !== 'Show' && currentName !== 'Series') {
                    setSeriesName(currentName);
                }
            }
        };
        fetchSeriesData();
    }, [review.tmdbId, review.seriesName, review.name, review.series_name]);


    const hasText = (review.review && review.review.trim().length > 0) || (review.review_text && review.review_text.trim().length > 0);
    const ratingVal = review.rating ? parseFloat(review.rating.toString()) : 0;

    // Resolve Poster: use the centralized resolver
    const resolvedPoster = getResolvedPosterUrl(
        review.tmdbId || review.tmdb_id,
        review.poster_path || review.posterPath || review.seasonPoster,
        userData?.customPosters || {},
        'w92',
        review.seasonNumber || 0
    );

    const navigateToSeries = () => {
        router.push({
            pathname: `/(tabs)/series/${review.tmdbId || review.tmdb_id}`,
            params: { selectedSeason: review.seasonNumber }
        } as any);
    };

    const handlePress = () => {
        if (onPress) {
            onPress();
            return;
        }

        if (isMe) {
            router.push({
                pathname: '/review',
                params: {
                    type: review.isEpisode ? 'episode' : 'season',
                    id: review.tmdbId,
                    season: review.seasonNumber,
                    episode: review.episodeNumber,
                    name: seriesName, // Use fresh name
                    poster_path: review.poster_path, // Could hydrate this too, but usually poster is fine
                    existingReview: JSON.stringify(review)
                }
            });
        } else {
            // Priority: Navigate to Series/Season Page instead of profile
            navigateToSeries();
        }
    };

    const seasonInfo = review.seasonNumber
        ? `Season ${review.seasonNumber}${review.episodeNumber ? ` • Ep ${review.episodeNumber}` : ''}`
        : '';

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.reviewCard}
                onPress={handlePress}
                activeOpacity={0.7}
            >
                {/* Left: Avatar */}
                <TouchableOpacity onPress={() => router.push(`/(tabs)/public-profile/${review.userId}` as any)}>
                    <Image
                        source={{ uri: photoURL ? photoURL : 'https://via.placeholder.com/40' }}
                        style={styles.avatar}
                        contentFit="cover"
                    />
                </TouchableOpacity>

                {/* Center: Content */}
                <View style={styles.contentContainer}>

                    {/* SERIES INFO HEADER */}
                    <View style={styles.seriesHeader}>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); navigateToSeries(); }}>
                            <Text style={styles.seriesTitle} numberOfLines={1}>
                                {seriesName.replace(/[\(:\-]?\s*(Season|Episode|S|Ep\.?)\s*\d+.*$/i, '').trim()}
                                <Text style={styles.seasonInfoText}>  {seasonInfo}</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Username & Stars */}
                    <View style={styles.headerRow}>
                        <Text style={styles.username}>{username}</Text>
                        {hasText && (
                            <View style={{ marginLeft: 8 }}>
                                {renderStars(ratingVal, 10)}
                            </View>
                        )}
                    </View>

                    {/* Body: Text Only (Poster Removed) */}
                    <View style={styles.bodyRow}>
                        <View style={{ flex: 1 }}>
                            {hasText ? (
                                <Text style={styles.reviewText} numberOfLines={8}>
                                    {review.review || review.review_text}
                                </Text>
                            ) : (
                                <View style={{ marginTop: 4 }}>
                                    {renderStars(ratingVal, 14)}
                                </View>
                            )}

                            {/* Bottom Indicator */}
                            <View style={{ marginTop: 8 }}>
                                <Text style={{ color: '#666', fontSize: 11, fontWeight: '700' }}>
                                    {review.isEpisode
                                        ? `EPISODE ${review.episodeNumber}`
                                        : `SEASON ${review.seasonNumber}`
                                    }
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Right: Report Button (Top corner) */}
                {!isMe && (
                    <View style={styles.rightSide}>
                        <TouchableOpacity
                            style={styles.reportBtn}
                            onPress={() => setReportModalVisible(true)}
                        >
                            <AlertTriangle size={15} color="#cc0000" strokeWidth={3} />
                        </TouchableOpacity>
                    </View>
                )}
            </TouchableOpacity>

            <ReportReviewModals
                visible={reportModalVisible}
                onClose={() => setReportModalVisible(false)}
                activity={{
                    user_name: username,
                    user_id: review.userId,
                    series_name: seriesName,
                    season_number: review.seasonNumber,
                    episode_number: review.episodeNumber,
                    review_text: review.review ?? ''
                }}
                reporterData={{
                    username: userData?.username || '',
                    email: currentUser?.email || ''
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.15)',
        paddingBottom: 16,
    },
    reviewCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 0,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#222',
        marginRight: 10,
        marginTop: 4,
    },
    contentContainer: {
        flex: 1,
        marginRight: 10,
    },
    seriesHeader: {
        marginBottom: 4,
    },
    seriesTitle: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '900',
    },
    seasonInfoText: {
        color: '#AAA',
        fontWeight: 'bold',
        fontSize: 12,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    username: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
    },
    bodyRow: {
        flexDirection: 'row',
        gap: 10,
    },
    smallPoster: {
        width: 40,
        height: 60,
        borderRadius: 4,
        backgroundColor: '#222'
    },
    reviewText: {
        color: '#CCC',
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '400',
    },
    rightSide: {
        marginLeft: 'auto',
    },
    reportBtn: {
        padding: 4,
    },
});

export default ReviewItem;
