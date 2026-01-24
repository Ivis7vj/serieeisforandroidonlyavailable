import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Star, X } from 'lucide-react-native';
import { formatTimeAgo } from '@/utils/date';
import { useAuth } from '@/context/auth-context';
import { db } from '@/utils/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface ActivityRendererProps {
    activity: any;
    variant?: 'friend' | 'profile';
    userId?: string;
    onReviewClick?: (activity: any) => void;
}

export default function ActivityRenderer({ activity, onReviewClick, variant = 'friend', userId }: ActivityRendererProps) {
    const router = useRouter();
    const { currentUser } = useAuth();
    const [previewVisible, setPreviewVisible] = React.useState(false);
    const [currentPhotoURL, setCurrentPhotoURL] = React.useState<string | null>(null);
    const rating = parseFloat(activity.rating || '0');

    // Fetch fresh user data to ensure photo is up-to-date
    React.useEffect(() => {
        const fetchLatestProfile = async () => {
            const targetUserId = activity.userId || userId;
            if (!targetUserId) return;

            // If it's me, use my current auth profile immediately
            if (currentUser && targetUserId === currentUser.uid) {
                if (currentUser.photoURL !== currentPhotoURL) {
                    setCurrentPhotoURL(currentUser.photoURL);
                }
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, 'users', targetUserId));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.photoURL) {
                        setCurrentPhotoURL(userData.photoURL);
                    }
                }
            } catch (err) {
                // Silently fail and use snapshot
            }
        };

        fetchLatestProfile();
    }, [activity.userId, userId, currentUser]);

    // Use fresh photo if available, otherwise fallback to snapshot
    const displayPhoto = currentPhotoURL || activity.userProfilePicURL || activity.photoURL || `https://image.tmdb.org/t/p/w200${activity.posterPath}`;

    if (variant === 'profile') {
        const date = new Date(activity.createdAt);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const finalTime = `${dateStr} · ${timeStr}`;

        let headerText = "";
        let subText: React.ReactNode = "";

        if (activity.type === 'watched_episode') {
            headerText = "watched this series";
            subText = `S${activity.seasonNumber} · E${activity.episodeNumber}`;
        } else if (activity.type === 'completed_season') {
            headerText = "finished";
            subText = `Season ${activity.seasonNumber}`;
        } else if (activity.type === 'poster_updated') {
            headerText = activity.customText || "chose this poster for";
        } else if (activity.type === 'rated_season') {
            headerText = "rated";
            subText = (
                <View style={styles.profileMetaRow}>
                    <Text style={styles.profileSubText}>S{activity.seasonNumber} </Text>
                    <View style={styles.profileRatingRow}>
                        {[...Array(5)].map((_, i) => (
                            <Star
                                key={i}
                                size={12}
                                fill={i < rating ? "#FFD600" : "transparent"}
                                color={i < rating ? "#FFD600" : "#444"}
                            />
                        ))}
                    </View>
                </View>
            );
        } else if (activity.type === 'watchlist_add') {
            headerText = "watchlisted";
        } else if (activity.type === 'liked_series') {
            headerText = "liked";
        } else if (activity.type === 'liked_season') {
            headerText = "liked";
            subText = `Season ${activity.seasonNumber}`;
        }

        return (
            <View style={styles.profileCard}>
                {/* User Avatar */}
                <Pressable
                    style={styles.profileAvatarContainer}
                    onPress={() => router.push(`/(tabs)/public-profile/${activity.userId}` as any)}
                >
                    <Image
                        source={{ uri: displayPhoto }}
                        style={styles.profileAvatar}
                        contentFit="cover"
                    />
                </Pressable>

                {/* Mini Poster */}
                <Pressable
                    style={styles.profileMiniPosterContainer}
                    onPress={() => {
                        if (activity.type === 'poster_updated') {
                            setPreviewVisible(true);
                        } else {
                            router.push(`/series/${activity.tmdbId}` as any);
                        }
                    }}
                >
                    {activity.posterPath && (
                        <Image
                            source={{ uri: `https://image.tmdb.org/t/p/w200${activity.posterPath}` }}
                            style={styles.profileMiniPoster}
                            contentFit="cover"
                        />
                    )}
                </Pressable>

                {/* Content */}
                <View style={styles.profileContent}>
                    <Text style={styles.profileHeader}>
                        <Text style={styles.profileUsername}>{activity.userId === currentUser?.uid ? 'You' : (activity.username || 'User')}</Text>
                        <Text style={styles.profileAction}> {headerText}</Text>
                    </Text>
                    {activity.type !== 'watched_episode' && (
                        <Text style={styles.profileSeriesName} numberOfLines={1}>
                            {activity.seriesName}
                        </Text>
                    )}
                    {activity.type === 'watched_episode' && (
                        <Text style={styles.profileSeriesName} numberOfLines={1}>
                            {activity.seriesName}
                        </Text>
                    )}
                    {subText && (typeof subText === 'string' ? <Text style={styles.profileSubText}>{subText}</Text> : subText)}
                </View>

                {/* Time */}
                <View style={styles.profileTimeContainer}>
                    <Text style={styles.profileTime}>{finalTime}</Text>
                </View>

                {/* Poster Preview Modal */}
                <Modal
                    visible={previewVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setPreviewVisible(false)}
                >
                    <Pressable
                        style={styles.modalOverlay}
                        onPress={() => setPreviewVisible(false)}
                    >
                        <View style={styles.modalContent}>
                            <Pressable
                                style={styles.closeBtn}
                                onPress={() => setPreviewVisible(false)}
                            >
                                <X color="#FFF" size={30} />
                            </Pressable>
                            <Image
                                source={{ uri: `https://image.tmdb.org/t/p/original${activity.posterPath}` }}
                                style={styles.fullPoster}
                                contentFit="contain"
                            />
                        </View>
                    </Pressable>
                </Modal>
            </View>
        );
    }

    // Default to Friend Card Style
    return (
        <View style={styles.card}>
            {/* Poster - Left Side */}
            <Pressable onPress={() => {
                if (activity.type === 'poster_updated') {
                    setPreviewVisible(true);
                } else {
                    router.push(`/series/${activity.tmdbId}` as any);
                }
            }}>
                <Image
                    source={{ uri: `https://image.tmdb.org/t/p/w200${activity.posterPath}` }}
                    style={styles.poster}
                    contentFit="cover"
                />
            </Pressable>

            {/* Content - Right Side */}
            <View style={styles.content}>

                {/* Header: User + Time */}
                <View style={styles.headerRow}>
                    <Pressable
                        style={styles.userInfo}
                        onPress={() => router.push(`/(tabs)/public-profile/${activity.userId}` as any)}
                    >
                        <Image
                            source={{ uri: displayPhoto }}
                            style={styles.avatar}
                            contentFit="cover"
                        />
                        <Text style={styles.username} numberOfLines={1}>
                            {activity.username || activity.userName}
                        </Text>
                    </Pressable>
                    <Text style={styles.time}>{formatTimeAgo(activity.createdAt)}</Text>
                </View>

                {/* Series Info + Rating */}
                <View style={styles.metaRow}>
                    <Text style={styles.seriesName} numberOfLines={1}>
                        {activity.seriesName}
                        {activity.seasonNumber && (
                            <Text style={styles.seasonText}> S{activity.seasonNumber}</Text>
                        )}
                    </Text>
                    <View style={styles.ratingContainer}>
                        {[...Array(5)].map((_, i) => (
                            <Star
                                key={i}
                                size={12}
                                fill={i < rating ? "#FFD600" : "transparent"}
                                color={i < rating ? "#FFD600" : "#444"}
                            />
                        ))}
                    </View>
                </View>

                {/* Review Body */}
                <Pressable onPress={() => onReviewClick?.(activity)}>
                    <Text style={styles.reviewBody} numberOfLines={4}>
                        {activity.review || <Text style={styles.italic}>Rated {rating} stars</Text>}
                    </Text>
                </Pressable>

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        backgroundColor: '#111',
        marginBottom: 15,
        borderRadius: 8,
        overflow: 'hidden',
        padding: 10,
    },
    poster: {
        width: 70,
        height: 105,
        borderRadius: 4,
        backgroundColor: '#222',
    },
    content: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'flex-start',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    avatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        marginRight: 6,
        backgroundColor: '#333',
    },
    username: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    time: {
        color: '#888',
        fontSize: 12,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    seriesName: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 8,
    },
    seasonText: {
        color: '#888',
        fontWeight: 'normal',
    },
    ratingContainer: {
        flexDirection: 'row',
        gap: 1,
    },
    reviewBody: {
        color: '#DDD',
        fontSize: 13,
        lineHeight: 18,
    },
    italic: {
        fontStyle: 'italic',
        color: '#888',
    },
    // Profile Variant Styles
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        marginBottom: 20,
        paddingHorizontal: 5,
    },
    profileAvatarContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#333',
    },
    profileAvatar: {
        width: '100%',
        height: '100%',
    },
    profileMiniPosterContainer: {
        width: 40,
        aspectRatio: 2 / 3,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: '#222',
    },
    profileMiniPoster: {
        width: '100%',
        height: '100%',
    },
    profileContent: {
        flex: 1,
        minWidth: 0,
    },
    profileHeader: {
        fontSize: 12,
        marginBottom: 1,
    },
    profileUsername: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    profileAction: {
        color: '#888',
    },
    profileSeriesName: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    profileSubText: {
        color: '#888',
        fontSize: 12,
        marginTop: 1,
    },
    profileTimeContainer: {
        alignSelf: 'flex-start',
        paddingTop: 2,
    },
    profileTime: {
        color: '#666',
        fontSize: 12,
    },
    profileMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 2,
    },
    profileRatingRow: {
        flexDirection: 'row',
        gap: 2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
    },
    modalContent: {
        width: '90%',
        height: '80%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeBtn: {
        position: 'absolute',
        top: -40,
        right: 0,
        padding: 10,
        zIndex: 10,
    },
    fullPoster: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
    }
});
