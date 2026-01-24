import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Star, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatTimeAgo } from '@/utils/date';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';

export default function FriendActivityDetail() {
    const { serializedActivity } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Initial Loading State = true to show spinner immediately on mount
    const [loading, setLoading] = useState(true);

    const [activity, setActivity] = useState<any>(() => {
        try {
            return typeof serializedActivity === 'string' ? JSON.parse(serializedActivity) : {};
        } catch (e) {
            console.error("Failed to parse activity", e);
            return {};
        }
    });

    // Safety Timeout: Force loading false after 5s if stuck
    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 5000);
        return () => clearTimeout(timer);
    }, []);

    // FORCE RELOAD PFP ON FOCUS WITH SPINNER
    useFocusEffect(
        useCallback(() => {
            const refreshUserParams = async () => {
                setLoading(true); // Show Spinner on Focus

                const uid = activity.userId || activity.user_id; // Handle both casing
                if (!uid) {
                    setLoading(false);
                    return;
                }

                try {
                    const userDoc = await getDoc(doc(db, 'users', uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        if (userData.photoURL) {
                            setActivity((prev: any) => ({
                                ...prev,
                                userProfilePicURL: userData.photoURL,
                                photoURL: userData.photoURL // Update both legacy fields
                            }));
                        }
                    }
                } catch (e) {
                    console.error("Failed to refresh user params", e);
                } finally {
                    // Slight delay to ensure spinner is visible/felt (UX preference for "reload feel")
                    setTimeout(() => setLoading(false), 1200);
                }
            };

            refreshUserParams();

            // Cleanup: Reset to loading state when leaving
            return () => {
                setLoading(true);
            };
        }, [activity.userId, activity.user_id])
    );

    const rating = parseFloat(activity.rating || '0');
    const posterUrl = activity.posterPath
        ? `https://image.tmdb.org/t/p/w500${activity.posterPath}`
        : null;

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#FFD600" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Simple Close Header if Modal doesn't provide one automatically or if we want custom look */}

            <ScrollView contentContainerStyle={styles.scrollContent}>

                <View style={styles.headerSection}>
                    {posterUrl && (
                        <Image
                            source={{ uri: posterUrl }}
                            style={styles.poster}
                            contentFit="cover"
                        />
                    )}
                    <View style={styles.headerInfo}>
                        <Text style={styles.seriesTitle}>{activity.seriesName}</Text>
                        <Text style={styles.seasonInfo}>
                            {activity.seasonNumber ? `Season ${activity.seasonNumber}` : ''}
                            {activity.episodeNumber ? ` • Episode ${activity.episodeNumber}` : ''}
                        </Text>

                        <View style={styles.userRow}>
                            <Image
                                source={{ uri: activity.userProfilePicURL || activity.photoURL }}
                                style={styles.avatar}
                            />
                            <View>
                                <Text style={styles.username}>{activity.username}</Text>
                                <Text style={styles.date}>{formatTimeAgo(activity.createdAt)}</Text>
                            </View>
                        </View>

                        {rating > 0 && (
                            <View style={styles.ratingRow}>
                                {[...Array(5)].map((_, i) => (
                                    <Star
                                        key={i}
                                        size={16}
                                        fill={i < rating ? "#FFD600" : "transparent"}
                                        color={i < rating ? "#FFD600" : "#444"}
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                </View>

                {/* Review Content */}
                {activity.review ? (
                    <Text style={styles.reviewBody}>{activity.review}</Text>
                ) : (
                    <Text style={styles.noReviewText}>Rated without review.</Text>
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
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    headerSection: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    poster: {
        width: 100,
        height: 150,
        borderRadius: 8,
        backgroundColor: '#222',
        marginRight: 16,
    },
    headerInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    seriesTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    seasonInfo: {
        color: '#888',
        fontSize: 16,
        marginBottom: 12,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#333',
        marginRight: 10,
    },
    username: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    date: {
        color: '#666',
        fontSize: 12,
    },
    ratingRow: {
        flexDirection: 'row',
        gap: 2,
    },
    reviewBody: {
        color: '#EEE',
        fontSize: 16,
        lineHeight: 24,
        marginTop: 10,
    },
    noReviewText: {
        color: '#666',
        fontStyle: 'italic',
        marginTop: 10,
    }
});
