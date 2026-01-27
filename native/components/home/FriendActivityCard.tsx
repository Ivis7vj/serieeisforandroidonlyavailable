import React from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Star, Heart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import { useAuth } from '@/context/auth-context';

interface FriendActivityCardProps {
    activity: {
        id: string;
        tmdb_id: number;
        season_number: number;
        poster_path: string;
        series_name?: string;
        user_name: string;
        user_id: string;
        photo_url?: string;
        rating?: string | number;
        review_text?: string;
        created_at: string;
        isLiked?: boolean;
    };
    onPress?: () => void;
}

export function FriendActivityCard({ activity, onPress }: FriendActivityCardProps) {
    const router = useRouter();
    const { globalPosters } = useAuth();
    const resolvedPoster = getResolvedPosterUrl(activity.tmdb_id, activity.poster_path, globalPosters);

    const renderStars = (rating: string | number | undefined) => {
        if (!rating) return null;
        const num = Math.round(Number(rating));
        return (
            <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                        key={s}
                        size={10}
                        color={s <= num ? '#FFCC00' : '#333'}
                        fill={s <= num ? '#FFCC00' : 'transparent'}
                    />
                ))}
            </View>
        );
    };

    return (
        <TouchableOpacity
            style={styles.container}
            activeOpacity={0.7}
            onPress={onPress}
        >
            <View style={styles.posterWrapper}>
                <Image
                    source={{ uri: resolvedPoster ?? undefined }}
                    style={styles.poster}
                    contentFit="cover"
                    transition={300}
                />
                <View style={styles.seasonBadge}>
                    <Text style={styles.seasonText}>S{activity.season_number}</Text>
                </View>
            </View>

            {/* Friend Details Below Poster */}
            <View style={styles.detailsContainer}>
                <Pressable
                    style={styles.userRow}
                    onPress={() => router.push(`/(tabs)/public-profile/${activity.user_id}` as any)}
                    hitSlop={8}
                >
                    <View style={styles.avatarWrapper}>
                        <Image
                            source={{ uri: activity.photo_url || `https://image.tmdb.org/t/p/w200${activity.poster_path}` }}
                            style={styles.avatar}
                            contentFit="cover"
                        />
                    </View>
                    <Text style={styles.username} numberOfLines={1}>{activity.user_name}</Text>
                </Pressable>

                <View style={styles.ratingRow}>
                    {renderStars(activity.rating)}
                    {activity.isLiked && (
                        <Heart size={10} color="#666" fill="#666" style={{ marginLeft: 6 }} />
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 115,
    },
    posterWrapper: {
        width: 115,
        height: 170,
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#222',
    },
    poster: {
        width: '100%',
        height: '100%',
    },
    seasonBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    seasonText: {
        color: '#FFCC00',
        fontSize: 10,
        fontWeight: '900',
    },
    detailsContainer: {
        marginTop: 8,
        paddingLeft: 2,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    avatarWrapper: {
        width: 22,
        height: 22,
        borderRadius: 11,
        overflow: 'hidden',
        backgroundColor: '#222',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    username: {
        color: '#999', // Greyscale like the image
        fontSize: 14,
        fontWeight: '900',
        flex: 1,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 28, // Align with username
    },
    starsRow: {
        flexDirection: 'row',
        gap: 1,
    }
});
