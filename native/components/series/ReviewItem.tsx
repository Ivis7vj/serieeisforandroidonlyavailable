import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { useAuth } from '@/context/auth-context';
import { AlertTriangle } from 'lucide-react-native';
import { ReportReviewModals } from '../review/ReportReviewModals';

interface ReviewItemProps {
    review: any;
    renderStars: (rating: number, size: number) => React.ReactNode;
    isMe?: boolean;
}

const ReviewItem: React.FC<ReviewItemProps> = ({ review, renderStars, isMe }) => {
    const router = useRouter();
    const { userData, currentUser } = useAuth();
    const [photoURL, setPhotoURL] = useState<string | null>(review.photoURL || null);
    const [reportModalVisible, setReportModalVisible] = useState(false);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!review.userId) return;
            try {
                const userDoc = await getDoc(doc(db, 'users', review.userId));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    if (data.photoURL) {
                        setPhotoURL(data.photoURL);
                    }
                }
            } catch (error) {
                console.error("Error fetching user data for review:", error);
            }
        };

        fetchUserData();
    }, [review.userId]);

    const hasText = review.review && review.review.trim().length > 0;
    const ratingVal = review.rating ? parseFloat(review.rating.toString()) : 0;

    const handlePress = () => {
        if (isMe) {
            router.push({
                pathname: '/review',
                params: {
                    type: review.isEpisode ? 'episode' : 'season',
                    id: review.tmdbId,
                    season: review.seasonNumber,
                    episode: review.episodeNumber,
                    name: review.seriesName || review.name || (review.userName ? review.userName + "'s Review" : "Review"),
                    poster_path: review.poster_path,
                    existingReview: JSON.stringify(review)
                }
            });
        } else {
            router.push(`/(tabs)/public-profile/${review.userId}` as any);
        }
    };

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
                    {/* Header: Name + Stars (if text exists) */}
                    <View style={styles.headerRow}>
                        <Text style={styles.username}>{review.userName}</Text>
                        {hasText && (
                            <View style={{ marginLeft: 8 }}>
                                {renderStars(ratingVal, 10)}
                            </View>
                        )}
                    </View>

                    {/* Body: Text OR Large Stars (if no text) */}
                    {hasText ? (
                        <Text style={styles.reviewText} numberOfLines={3}>
                            {review.review}
                        </Text>
                    ) : (
                        <View style={{ marginTop: 4 }}>
                            {renderStars(ratingVal, 14)}
                        </View>
                    )}
                </View>

                {/* Right: Indicator & Report Button (Top corner) */}
                <View style={styles.rightSide}>
                    {/* Report Button - Top corner */}
                    {!isMe && (
                        <TouchableOpacity
                            style={styles.reportBtn}
                            onPress={() => setReportModalVisible(true)}
                        >
                            <AlertTriangle size={15} color="#cc0000" strokeWidth={3} />
                        </TouchableOpacity>
                    )}

                    {/* Indicator Badge (Bottom or aligned) */}
                    <View style={styles.indicatorContainer}>
                        <View style={styles.epBadge}>
                            <Text style={styles.epText}>
                                {review.isEpisode ? `EP ${review.episodeNumber}` : 'SEASON'}
                            </Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>

            <ReportReviewModals
                visible={reportModalVisible}
                onClose={() => setReportModalVisible(false)}
                activity={{
                    user_name: review.userName,
                    user_id: review.userId,
                    series_name: review.seriesName || review.name,
                    season_number: review.seasonNumber,
                    episode_number: review.episodeNumber, // Added episode number to payload
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
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#222',
        marginRight: 12,
    },
    contentContainer: {
        flex: 1,
        marginRight: 10,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    username: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },
    reviewText: {
        color: '#CCC',
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '400',
    },
    rightSide: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: '100%',
        minHeight: 45,
    },
    reportBtn: {
        padding: 4,
        marginTop: -4,
        marginRight: -4,
    },
    indicatorContainer: {
        marginTop: 'auto',
    },
    epBadge: {
        backgroundColor: '#1a1a1a',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#222'
    },
    epText: {
        color: '#888',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase'
    }
});

export default ReviewItem;
