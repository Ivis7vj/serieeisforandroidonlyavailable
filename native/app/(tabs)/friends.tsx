import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, Pressable, ActivityIndicator, RefreshControl, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, User as UserIcon, X } from 'lucide-react-native';
import { Image } from 'expo-image';
import { collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { supabase } from '@/utils/supabase';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { activityService } from '@/utils/activityService';
import ActivityItem from '@/components/friends/activity-item';
import Skeleton from '@/components/skeleton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReviewDrawer from '@/components/review/ReviewDrawer';

export default function FriendsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { userData } = useAuth(); // userData has .following

    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const [activities, setActivities] = useState<any[]>([]);
    const [feedLoading, setFeedLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Tip Logic
    const [showHint, setShowHint] = useState(false);
    const hintOpacity = useRef(new Animated.Value(0)).current;

    // Review Drawer State
    const [selectedReview, setSelectedReview] = useState<any>(null);
    const [drawerVisible, setDrawerVisible] = useState(false);

    useEffect(() => {
        const checkHint = async () => {
            const seen = await AsyncStorage.getItem('friend_search_hint_seen');
            if (!seen) {
                setShowHint(true);
                Animated.timing(hintOpacity, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true
                }).start();

                // Auto hide
                setTimeout(() => {
                    Animated.timing(hintOpacity, {
                        toValue: 0,
                        duration: 500,
                        useNativeDriver: true
                    }).start(() => setShowHint(false));
                    AsyncStorage.setItem('friend_search_hint_seen', 'true');
                }, 3000);
            }
        };
        checkHint();
    }, []);

    const fetchActivities = useCallback(async () => {
        if (!userData || !userData.following || userData.following.length === 0) {
            setActivities([]);
            setFeedLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const isoDate = oneWeekAgo.toISOString();

            // Query both tables in parallel
            const [seasonRes, episodeRes] = await Promise.all([
                supabase
                    .from('season_reviews')
                    .select('*')
                    .in('user_id', userData.following)
                    .gte('created_at', isoDate)
                    .order('created_at', { ascending: false })
                    .limit(30),
                supabase
                    .from('episode_reviews')
                    .select('*')
                    .in('user_id', userData.following)
                    .gte('created_at', isoDate)
                    .order('created_at', { ascending: false })
                    .limit(30)
            ]);

            if (seasonRes.error) throw seasonRes.error;
            if (episodeRes.error) throw episodeRes.error;

            // 1. Gather all raw items from all sources
            const supabaseReviews = [...(seasonRes.data || []), ...(episodeRes.data || [])];

            // FETCHING REAL ACTIVITIES FROM FIRESTORE
            const following = userData?.following || [];
            let firestoreActivities: any[] = [];

            if (following.length > 0) {
                const followChunks = [];
                for (let i = 0; i < following.length; i += 10) {
                    followChunks.push(following.slice(i, i + 10));
                }

                const weekLimit = new Date();
                weekLimit.setDate(weekLimit.getDate() - 7);

                const activityPromises = followChunks.map(async (chunk) => {
                    const q = query(
                        collection(db, 'user_activity'),
                        where('userId', 'in', chunk),
                        where('createdAt', '>=', weekLimit.toISOString()),
                        limit(50)
                    );
                    const snap = await getDocs(q);
                    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                });

                const results = await Promise.all(activityPromises);
                firestoreActivities = results.flat();
            }

            // 2. Extract ALL unique User IDs
            const allUserIds = [
                ...new Set([
                    ...supabaseReviews.map((i: any) => i.user_id),
                    ...firestoreActivities.map((i: any) => i.userId)
                ])
            ].filter(Boolean);

            // 3. Fetch Latest Profiles from Firestore (Forceful PFP Update)
            const userMap: Record<string, { photoURL?: string, username?: string }> = {};
            if (allUserIds.length > 0) {
                const chunks = [];
                for (let i = 0; i < allUserIds.length; i += 10) {
                    chunks.push(allUserIds.slice(i, i + 10));
                }

                await Promise.all(chunks.map(async (chunk) => {
                    const q = query(collection(db, 'users'), where('uid', 'in', chunk));
                    const snapshot = await getDocs(q);
                    snapshot.forEach(doc => {
                        const d = doc.data();
                        userMap[d.uid] = { photoURL: d.photoURL, username: d.username };
                    });
                }));
            }

            // 4. Map & Hydrate Supabase Items
            const seasonItems = (seasonRes.data || []).map((item: any) => ({
                id: item.id,
                tmdbId: item.tmdb_id,
                seriesName: item.series_name,
                seasonNumber: item.season_number,
                rating: item.rating,
                review: item.review_text,
                posterPath: item.poster_path,
                createdAt: item.created_at,
                userId: item.user_id,
                username: userMap[item.user_id]?.username || item.user_name || 'Unknown',
                userProfilePicURL: userMap[item.user_id]?.photoURL || item.photo_url || null,
                type: 'review_season'
            }));

            const episodeItems = (episodeRes.data || []).map((item: any) => ({
                id: item.id,
                tmdbId: item.tmdb_id,
                seriesName: item.series_name,
                seasonNumber: item.season_number,
                episodeNumber: item.episode_number,
                rating: item.rating,
                review: item.review_text,
                posterPath: item.poster_path,
                createdAt: item.created_at,
                userId: item.user_id,
                username: userMap[item.user_id]?.username || item.user_name || 'Unknown',
                userProfilePicURL: userMap[item.user_id]?.photoURL || item.photo_url || null,
                type: 'review_episode'
            }));

            // 5. Map & Hydrate Firestore Items
            const hydratedFirestore = firestoreActivities.map((d: any) => ({
                id: d.id,
                tmdbId: d.tmdbId,
                seriesName: d.seriesName,
                seasonNumber: d.seasonNumber,
                episodeNumber: d.episodeNumber,
                rating: d.rating,
                review: d.review,
                posterPath: d.posterPath,
                createdAt: d.createdAt,
                userId: d.userId,
                username: userMap[d.userId]?.username || d.username,
                userProfilePicURL: userMap[d.userId]?.photoURL || d.userProfilePicURL,
                type: d.type
            }));

            // 6. Combine and Sort
            let allActivities = [...seasonItems, ...episodeItems, ...hydratedFirestore].sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            setActivities(allActivities);

            // Mark Viewed
            activityService.markActivityViewed();

        } catch (error: any) {
            console.error("Error fetching friends feed from Supabase:", error);
        } finally {
            setFeedLoading(false);
            setRefreshing(false);
        }
    }, [userData]);

    useFocusEffect(
        useCallback(() => {
            // Reset Search State on Focus (User Requirement)
            setSearchText('');
            setSearchResults([]);
            setSearched(false);

            // Show Loader to mask the reset/fetch
            setFeedLoading(true);

            fetchActivities().finally(() => {
                // Ensure loader is visible for at least a moment (UX)
                setTimeout(() => setFeedLoading(false), 500);
            });
        }, [fetchActivities])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchActivities();
    };

    const handleSearch = async () => {
        if (!searchText.trim()) return;

        setSearchLoading(true);
        setSearched(true);
        setSearchResults([]);

        try {
            const q = query(
                collection(db, 'users'),
                where('username', '==', searchText.trim()), // Exact match
                limit(3)
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSearchResults(data);
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setSearchLoading(false);
        }
    };

    const clearSearch = () => {
        setSearchText('');
        setSearched(false);
        setSearchResults([]);
    };

    const handleActivityPress = (activity: any) => {
        // Map Activity to ReviewDrawer Format
        const reviewData = {
            ...activity,
            name: activity.seriesName,
            poster_path: activity.posterPath,
            isEpisode: !!activity.episodeNumber,
        };
        setSelectedReview(reviewData);
        setDrawerVisible(true);
    };

    const renderSearchResult = ({ item }: { item: any }) => (
        <Pressable
            style={styles.resultItem}
            onPress={() => router.push(`/(tabs)/public-profile/${item.uid || item.id}` as any)}
        >
            <View style={styles.avatarContainer}>
                {item.photoURL ? (
                    <Image source={{ uri: item.photoURL }} style={styles.avatar} contentFit="cover" />
                ) : (
                    <UserIcon color="#FFF" size={24} />
                )}
            </View>
            <Text style={styles.username}>{item.username || 'User'}</Text>
        </Pressable>
    );

    const renderActivity = ({ item }: { item: any }) => (
        <ActivityItem activity={item} onPress={handleActivityPress} />
    );

    return (
        <View style={[styles.container, { paddingTop: 6 }]}>
            <View style={styles.content}>

                {/* Header with Search */}
                <View style={styles.header}>


                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <Search color="#888" size={20} />
                            <TextInput
                                style={styles.input}
                                placeholder="Find friends..."
                                placeholderTextColor="#666"
                                value={searchText}
                                onChangeText={setSearchText}
                                onSubmitEditing={handleSearch}
                                returnKeyType="search"
                                autoCapitalize="none"
                            />
                            {searchText.length > 0 && (
                                <Pressable onPress={clearSearch} style={{ padding: 5 }}>
                                    <X color="#888" size={18} />
                                </Pressable>
                            )}
                        </View>
                        <Pressable style={styles.searchBtn} onPress={handleSearch}>
                            {searchLoading ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.searchBtnText}>Search</Text>}
                        </Pressable>
                    </View>

                    {/* Hint Tooltip */}
                    {showHint && (
                        <Animated.View style={[styles.hintTooltip, { opacity: hintOpacity }]}>
                            <Text style={styles.hintTooltipText}>Find friends</Text>
                            {/* Little triangle */}
                            <View style={styles.hintArrow} />
                        </Animated.View>
                    )}
                </View>

                {/* Main Content */}
                {searched ? (
                    <FlatList
                        data={searchResults}
                        renderItem={renderSearchResult}
                        keyExtractor={item => item.uid || item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            !searchLoading ? (
                                <View style={styles.centerParams}>
                                    <Text style={styles.emptyText}>No user found.</Text>
                                </View>
                            ) : null
                        }
                    />
                ) : (
                    <FlatList
                        data={activities}
                        renderItem={renderActivity}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.feedContent} // New style for feed
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFCC00" />
                        }
                        ListEmptyComponent={
                            feedLoading ? (
                                <Skeleton />
                            ) : (
                                <View style={styles.centerParams}>
                                    <Text style={styles.hintText}>No activity yet.</Text>
                                </View>
                            )
                        }
                    />
                )}
            </View>

            {/* Review Drawer */}
            <ReviewDrawer
                visible={drawerVisible}
                onClose={() => {
                    setDrawerVisible(false);
                    setSelectedReview(null);
                }}
                reviewData={selectedReview}
                onReviewChanged={fetchActivities}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    content: {
        flex: 1,
        // Remove paddingHorizontal to allow full bleed list
    },
    header: {
        marginBottom: 0,
        paddingHorizontal: 16,
        paddingBottom: 0,
        zIndex: 10,
    },
    pageTitle: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
    searchContainer: {
        flexDirection: 'row',
        gap: 12,
        zIndex: 10,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        height: 40, // Slightly smaller
        borderRadius: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#222',
    },
    input: {
        flex: 1,
        color: '#FFF',
        fontSize: 14,
    },
    searchBtn: {
        backgroundColor: '#FFCC00',
        paddingHorizontal: 16,
        justifyContent: 'center',
        borderRadius: 8,
        alignItems: 'center',
        height: 40,
    },
    searchBtnText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 14,
    },
    hintTooltip: {
        position: 'absolute',
        top: 45,
        left: 20,
        backgroundColor: '#FFCC00',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        zIndex: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    hintTooltipText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 12,
    },
    hintArrow: {
        position: 'absolute',
        top: -6,
        left: 10,
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderBottomWidth: 6,
        borderStyle: 'solid',
        backgroundColor: 'transparent',
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: '#FFCC00',
    },
    listContent: {
        paddingTop: 10,
        paddingHorizontal: 16,
    },
    feedContent: {
        paddingTop: 0,
    },
    // ... Old styles can remain or be cleaned up if unused, but avoiding massive delete for safety
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#111',
        marginBottom: 8,
        borderRadius: 8,
    },
    avatarContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#222',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    username: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    centerParams: {
        paddingTop: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#111',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyText: {
        color: '#888',
        fontSize: 16,
    },
    hintText: {
        color: '#666',
        fontSize: 15,
        textAlign: 'center',
        maxWidth: 240,
        lineHeight: 22,
    }
});
