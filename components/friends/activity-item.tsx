import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Star, User as UserIcon, X } from 'lucide-react-native';
import { formatTimeAgo } from '@/utils/date';
import { Modal } from 'react-native';
import { useAuth } from '@/context/auth-context';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import { useRouter } from 'expo-router';

interface ActivityItemProps {
    activity: any;
    onPress: (activity: any) => void;
}

export default function ActivityItem({ activity, onPress }: ActivityItemProps) {
    const router = useRouter();
    const [previewVisible, setPreviewVisible] = React.useState(false);
    const rating = parseFloat(activity.rating || '0');
    const isReview = !!activity.review;

    // Determine Action Text
    let actionText = "watched"; // generic fallback
    if (activity.type === 'review_season') actionText = "reviewed season";
    if (activity.type === 'review_episode') actionText = "reviewed episode";
    if (activity.type === 'liked_season') actionText = "liked";
    if (activity.type === 'changed_poster') actionText = "changed the poster";
    if (activity.type === 'added_to_list') actionText = "added to list";

    if (activity.review) {
        actionText = "reviewed";
    } else if (activity.rating && !activity.type?.includes('liked')) {
        actionText = "rated";
    }

    const { globalPosters } = useAuth();

    // Format Title
    const title = activity.seriesName || "Untitled";
    const seasonText = activity.seasonNumber ? `Season ${activity.seasonNumber}` : "";
    const epText = activity.episodeNumber ? ` • E${activity.episodeNumber}` : "";
    const metaText = `${seasonText}${epText}`;

    // Poster URL - Calculate for ALL items (used as fallback for avatar)
    const posterUrl = getResolvedPosterUrl(
        activity.tmdbId,
        activity.posterPath,
        globalPosters,
        'w500',
        activity.seasonNumber || 0
    );

    // Only show on the right column if it's a "visual" activity
    const showRightPoster = !!activity.review || activity.type === 'changed_poster' || activity.type === 'review_season' || activity.type === 'review_episode';

    // Local Time Formatting: h -> hrs (No space as requested)
    let timeAgo = formatTimeAgo(activity.createdAt);
    if (timeAgo.endsWith('h')) {
        timeAgo = timeAgo.replace('h', 'hrs');
    }

    // Interaction Logic: Only rating and review allow touch
    const isInteractive = !!activity.review ||
        (activity.type === 'review_season' || activity.type === 'review_episode') ||
        (activity.rating > 0 && !activity.type?.includes('liked'));

    return (
        <Pressable
            style={styles.container}
            onPress={() => isInteractive && onPress(activity)}
            disabled={!isInteractive}
        >
            {/* Left Column: Avatar */}
            <Pressable
                style={styles.leftCol}
                onPress={() => router.push(`/(tabs)/public-profile/${activity.userId}` as any)}
            >
                <Image
                    source={{ uri: activity.userProfilePicURL || activity.photoURL || (posterUrl || undefined) }}
                    style={styles.avatar}
                    contentFit="cover"
                    transition={200}
                />
            </Pressable>

            {/* Center Column: Content */}
            <View style={[styles.centerCol, !showRightPoster && { paddingRight: 0 }]}>
                <View style={styles.textStack}>
                    <Text style={styles.actionText}>{activity.username} {actionText}</Text>
                    <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
                    {!!metaText && <Text style={styles.metaText}>{metaText}</Text>}

                    {/* Stars Moved Here (Center, below meta, above review) */}
                    {rating > 0 && (
                        <View style={styles.ratingRowCenter}>
                            {[...Array(5)].map((_, i) => (
                                <Star
                                    key={i}
                                    size={10}
                                    fill={i < rating ? "#FFD600" : "transparent"}
                                    color={i < rating ? "#FFD600" : "#444"}
                                />
                            ))}
                        </View>
                    )}

                    {/* Review Preview */}
                    {isReview && (
                        <Text style={styles.reviewPreview} numberOfLines={3}>
                            {activity.review}
                        </Text>
                    )}
                </View>

                {/* Poster (Only if review or changed poster) */}
                {(showRightPoster && posterUrl) && (
                    <Pressable onPress={() => {
                        if (activity.type === 'changed_poster') {
                            setPreviewVisible(true);
                        } else {
                            onPress(activity);
                        }
                    }}>
                        <Image
                            source={{ uri: posterUrl }}
                            style={styles.poster}
                            contentFit="cover"
                        />
                    </Pressable>
                )}
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
                            source={{ uri: posterUrl || undefined }}
                            style={styles.fullPoster}
                            contentFit="contain"
                        />
                    </View>
                </Pressable>
            </Modal>

            {/* Right Column: Meta */}
            <View style={styles.rightCol}>
                <Text style={styles.timeText}>{timeAgo}</Text>
                {/* Removed Stars from here */}
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#111',
        backgroundColor: '#000',
    },
    leftCol: {
        width: 40,
        marginRight: 12,
        alignItems: 'center',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#222',
    },
    centerCol: {
        flex: 1,
        flexDirection: 'row',
    },
    textStack: {
        flex: 1,
        marginRight: 10,
    },
    poster: {
        width: 44,
        height: 66,
        borderRadius: 2,
        backgroundColor: '#222',
    },
    rightCol: {
        width: 50,
        alignItems: 'flex-end',
        marginLeft: 4,
    },
    actionText: {
        color: '#888', // Soft gray
        fontSize: 13,
        marginBottom: 2,
    },
    titleText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    metaText: {
        color: '#666',
        fontSize: 13,
        marginBottom: 4,
    },
    reviewPreview: {
        color: '#CCC',
        fontSize: 14,
        lineHeight: 20,
        marginTop: 4,
    },
    timeText: {
        color: '#666',
        fontSize: 12,
        marginBottom: 6,
    },
    ratingRowCenter: {
        flexDirection: 'row',
        gap: 1,
        marginBottom: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
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
