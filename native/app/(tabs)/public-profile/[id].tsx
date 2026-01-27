import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Pressable,
    RefreshControl,
    Dimensions,
    Platform,
    Alert,
    TouchableOpacity,
    Linking,
    Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MoreVertical, Plus, Instagram, Twitter, X, ArrowLeft, Star, MessageCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming } from 'react-native-reanimated';
import { MaterialIcons, FontAwesome6 } from '@expo/vector-icons';

import { useAuth } from '@/context/auth-context';
import { db, storage } from '@/utils/firebase';
import { doc, updateDoc, collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getUserProfileData } from '@/utils/profile-service';
import ActivityFeed from '@/components/activity-feed';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import { triggerSelection, triggerImpact } from '@/utils/haptics';
import { followUser, unfollowUser, isFollowingUser } from '@/utils/follow-service';
import ReviewItem from '@/components/series/ReviewItem';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const GAP = 10;
const PADDING = 32;
const TILE_SIZE = Math.floor((width - PADDING - (GAP * (COLUMN_COUNT - 1))) / COLUMN_COUNT) - 1;

interface PosterProps {
    item: any;
    onPress: () => void;
    showBadges?: boolean;
    userPosters?: any;
}

const PosterGridItem = ({ item, onPress, showBadges = false, userPosters }: PosterProps) => {
    const rawPoster = item.seasonPoster || item.season_poster_path || item.poster_path || item.posterPath;
    const seriesId = String(item.seriesId || item.tmdbId || item.tmdb_id || item.id);

    const resolvedUrl = useMemo(() => {
        return getResolvedPosterUrl(seriesId, rawPoster, userPosters, 'w342', item.seasonNumber, true, true);
    }, [seriesId, rawPoster, userPosters, item.seasonNumber]);

    return (
        <Pressable style={{ width: TILE_SIZE, height: TILE_SIZE * 1.5, borderRadius: 8, overflow: 'hidden', backgroundColor: '#111' }} onPress={onPress}>
            <Image
                source={{ uri: resolvedUrl || undefined }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
            />
            {showBadges && item.seasonNumber && (
                <View style={styles.diarySeasonBadge}>
                    <Text style={styles.diarySeasonText}>S{item.seasonNumber}</Text>
                </View>
            )}
            {showBadges && item.episodeCount && (
                <View style={styles.epsBadge}>
                    <Text style={styles.epsText}>{item.episodeCount} EPS</Text>
                </View>
            )}
            {showBadges && item.date && (
                <View style={styles.diaryDateBadge}>
                    <Text style={styles.diaryDateText}>
                        {new Date(item.date).getDate()} {new Date(item.date).toLocaleString('default', { month: 'short' })}
                    </Text>
                </View>
            )}
        </Pressable>
    );
};

export default function PublicProfileScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { currentUser, selectionMode, globalPosters } = useAuth();
    const targetUid = (id as string);
    const isOwnProfile = targetUid === currentUser?.uid;

    const [profileData, setProfileData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('Profile');
    const [showFullPFP, setShowFullPFP] = useState(false);

    const followIconScale = useSharedValue(1);

    useEffect(() => {
        followIconScale.value = withSequence(withTiming(1.2), withSpring(1));
    }, [isFollowing]);

    const animatedFollowStyle = useAnimatedStyle(() => ({
        transform: [{ scale: followIconScale.value }]
    }));

    const loadData = useCallback(async (isRefreshing = false) => {
        if (!targetUid) return;
        if (!isRefreshing) setLoading(true);
        try {
            const data = await getUserProfileData(targetUid);
            setProfileData(data);

            if (!isOwnProfile && currentUser) {
                const following = await isFollowingUser(currentUser.uid, targetUid);
                setIsFollowing(following);
            }
        } catch (error) {
            console.error("Failed to load profile data:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [targetUid, currentUser, isOwnProfile]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData(true);
    };

    const handleFollowToggle = async () => {
        if (!currentUser || !targetUid || followLoading) return;
        triggerImpact();
        setFollowLoading(true);
        try {
            if (isFollowing) {
                await unfollowUser(currentUser.uid, targetUid);
                setIsFollowing(false);
            } else {
                await followUser(currentUser.uid, targetUid);
                setIsFollowing(true);
            }
            loadData(true);
        } catch (e) {
            Alert.alert("Error", "Action failed.");
        } finally {
            setFollowLoading(false);
        }
    };

    const handleEditPFP = async () => {
        triggerSelection();
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0].uri) {
            uploadPFP(result.assets[0].uri);
        }
    };

    const uploadPFP = async (uri: string) => {
        if (!currentUser) return;
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const filename = `profile_${currentUser.uid}_${Date.now()}.jpg`;
            const storageRef = ref(storage, `profile_photos/${filename}`);
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);
            await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: downloadURL });
            loadData(true);
        } catch (e) {
            Alert.alert("Error", "Failed to upload photo.");
        }
    };

    const renderTabContent = () => {
        if (!profileData) return null;
        const { userInfo, userPosters } = profileData;

        // Only render Profile (Favorites) tab content here. 
        // Other tabs now navigate to a new page.
        const favs = userInfo?.favorites || [];
        const paddedFavs = [...favs.slice(0, 5), ...Array(Math.max(0, 5 - favs.length)).fill(null)];
        return (
            <View style={styles.tabSection}>
                <Text style={styles.sectionLabel}>Favorite Series</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoritesGrid}>
                    {paddedFavs.map((fav, i) => (
                        <Pressable
                            key={i}
                            style={styles.favBox}
                            onPress={() => {
                                if (isOwnProfile) {
                                    router.push('/search');
                                } else if (fav) {
                                    router.push(`/series/${fav.id || fav.tmdbId}` as any);
                                }
                            }}
                        >
                            {fav ? (
                                <Image
                                    source={{ uri: getResolvedPosterUrl(String(fav.id || fav.tmdbId), fav.poster_path, isOwnProfile ? globalPosters : userPosters, 'w342') || undefined }}
                                    style={StyleSheet.absoluteFillObject}
                                    contentFit="cover"
                                />
                            ) : (
                                <Plus color="#222" size={32} />
                            )}
                        </Pressable>
                    ))}
                </ScrollView>
            </View>
        );
    };

    if (loading && !profileData) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFCC00" size="large" />
            </View>
        );
    }

    const user = profileData?.userInfo;

    return (
        <View style={styles.container}>
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFCC00" />}
                stickyHeaderIndices={[]}
                contentContainerStyle={Platform.OS === 'ios' ? { paddingBottom: 100 } : { paddingBottom: 100 }}
            >
                {followLoading && (
                    <View style={styles.globalLoading}>
                        <ActivityIndicator size="large" color="#FFCC00" />
                    </View>
                )}

                {/* Banner Section */}
                <Pressable
                    style={styles.bannerContainer}
                    onPress={() => isOwnProfile && router.push('/banner-search')}
                >
                    {user?.bannerBackdropPath ? (
                        <Image
                            key={`banner-${user.bannerBackdropPath}`}
                            source={{ uri: `https://image.tmdb.org/t/p/w1280${user.bannerBackdropPath}` }}
                            style={styles.bannerImage}
                            contentFit="cover"
                            transition={300}
                        />
                    ) : (
                        <View style={styles.bannerPlaceholder}>
                            <Text style={styles.bannerTitle}>No banner set</Text>
                        </View>
                    )}
                    <View style={styles.bannerOverlay} />
                </Pressable>

                <View style={styles.wrapper}>
                    {/* Header: Avatar + Stats */}
                    <View style={styles.headerGrid}>
                        <View style={styles.avatarArea}>
                            <View>
                                <Pressable style={styles.avatarCircle} onPress={() => setShowFullPFP(true)}>
                                    {user?.photoURL ? (
                                        <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
                                    ) : (
                                        <Text style={styles.avatarInitial}>{user?.username?.charAt(0).toUpperCase()}</Text>
                                    )}
                                </Pressable>
                                {!isOwnProfile && (
                                    <Animated.View style={[styles.followIconContainer, animatedFollowStyle]}>
                                        <Pressable
                                            onPress={handleFollowToggle}
                                            disabled={followLoading}
                                            style={({ pressed }) => [
                                                styles.followIconPressable,
                                                { transform: [{ scale: pressed ? 0.92 : 1 }] }
                                            ]}
                                        >
                                            {followLoading ? (
                                                <ActivityIndicator size="small" color="#000" />
                                            ) : (
                                                <MaterialIcons
                                                    name={isFollowing ? "check-circle" : "add-circle"}
                                                    size={32}
                                                    color="#FFCC00"
                                                />
                                            )}
                                        </Pressable>
                                    </Animated.View>
                                )}
                            </View>
                            <View style={styles.socialIcons}>
                                {user?.instaLink && (
                                    <TouchableOpacity onPress={() => {
                                        const url = user.instaLink.startsWith('http') ? user.instaLink : `https://instagram.com/${user.instaLink}`;
                                        Linking.openURL(url);
                                    }}>
                                        <Instagram color="#888" size={18} />
                                    </TouchableOpacity>
                                )}
                                {(user?.twitterLink || user?.twitter) && (
                                    <TouchableOpacity onPress={() => {
                                        const handle = user.twitterLink || user.twitter;
                                        const url = handle.startsWith('http') ? handle : `https://x.com/${handle}`;
                                        Linking.openURL(url);
                                    }}>
                                        <FontAwesome6 name="x-twitter" size={16} color="#888" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        <View style={styles.detailsArea}>
                            <View style={styles.usernameRow}>
                                <Text style={styles.username} numberOfLines={1}>{user?.username || 'User'}</Text>
                            </View>

                            <View style={styles.statsContainer}>
                                <View style={styles.statBox}>
                                    <Text style={styles.statNum}>
                                        {profileData?.diary ?
                                            new Set(profileData.diary
                                                .filter((d: any) => d.date && d.date.startsWith(new Date().getFullYear().toString()))
                                                .map((d: any) => `${d.tmdbId}-${d.seasonNumber}`)
                                            ).size : 0
                                        }
                                    </Text>
                                    <Text style={styles.statLabel}>THIS YEAR</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.statBox}
                                    onPress={() => {
                                        triggerSelection();
                                        router.push({
                                            pathname: '/profile-section',
                                            params: { uid: targetUid, type: 'Followers' }
                                        } as any);
                                    }}
                                >
                                    <Text style={styles.statNum}>{user?.followers?.length || 0}</Text>
                                    <Text style={styles.statLabel}>FOLLOWERS</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.statBox}
                                    onPress={() => {
                                        triggerSelection();
                                        router.push({
                                            pathname: '/profile-section',
                                            params: { uid: targetUid, type: 'Following' }
                                        } as any);
                                    }}
                                >
                                    <Text style={styles.statNum}>{user?.following?.length || 0}</Text>
                                    <Text style={styles.statLabel}>FOLLOWING</Text>
                                </TouchableOpacity>
                            </View>

                            {user?.bio && <Text style={[styles.bio, { paddingHorizontal: 16 }]}>{user.bio}</Text>}
                        </View>
                    </View>

                    {/* Tabs */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsNav}>
                        {['Profile', 'Diary', 'Reviews', 'Activity', 'Tracking', 'Liked'].map(tab => (
                            <Pressable
                                key={tab}
                                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                                onPress={() => {
                                    triggerSelection();
                                    if (tab === 'Profile') {
                                        setActiveTab(tab);
                                    } else {
                                        router.push({
                                            pathname: '/profile-section',
                                            params: { uid: targetUid, type: tab }
                                        } as any);
                                    }
                                }}
                            >
                                <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>{tab}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>

                    <View style={styles.tabsContent}>
                        {renderTabContent()}
                    </View>
                </View>
            </ScrollView>

            {showFullPFP && user?.photoURL && (
                <Pressable style={styles.fullPfpOverlay} onPress={() => setShowFullPFP(false)}>
                    <View style={styles.fullPfpModal}>
                        <Image source={{ uri: user.photoURL }} style={styles.fullPfpImg} contentFit="contain" />
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setShowFullPFP(false)}>
                            <X color="white" size={32} />
                        </TouchableOpacity>
                    </View>
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
    bannerContainer: { width: width, aspectRatio: 2.5 / 1, backgroundColor: '#000', position: 'relative', overflow: 'hidden' },
    bannerImage: { width: '100%', height: '100%' },
    bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.1)' },
    bannerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    bannerTitle: { color: '#444', fontWeight: 'bold', fontSize: 16 },
    backBtn: { position: 'absolute', top: 0, left: 10, zIndex: 100, padding: 10 },
    wrapper: { width: '100%', zIndex: 10, marginTop: 10 },
    headerGrid: { flexDirection: 'row', gap: 10, marginBottom: 20, paddingHorizontal: 16 },
    avatarArea: { width: 100, alignItems: 'center', gap: 12 },
    avatarCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1a1a1a', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
    avatarImg: { width: '100%', height: '100%' },
    avatarInitial: { color: '#888', fontSize: 32, fontWeight: 'bold' },
    socialIcons: { flexDirection: 'row', gap: 15 },
    detailsArea: { flex: 1, paddingTop: 10 },
    usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    username: { color: '#FFF', fontSize: 24, fontWeight: '900', flexShrink: 1 },
    followIconContainer: {
        position: 'absolute',
        bottom: -5,
        alignSelf: 'center',
        backgroundColor: '#000',
        borderRadius: 20,
        padding: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 5,
    },
    followIconPressable: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    statsContainer: { flexDirection: 'row', gap: 15, marginBottom: 15 },
    statBox: { alignItems: 'center' },
    statNum: { color: '#FFF', fontSize: 16, fontWeight: '900' },
    statLabel: { color: '#888', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
    bio: { color: '#888', fontSize: 13, lineHeight: 18 },
    tabsNav: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#222', marginTop: 10, marginBottom: 20, width: '100%' },
    tabBtn: { paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabBtnActive: { borderBottomColor: '#FFCC00' },
    tabBtnText: { color: '#888', fontWeight: '900', fontSize: 13 },
    tabBtnTextActive: { color: '#FFF' },
    tabsContent: { minHeight: 300 },
    tabSection: { gap: 20 },
    sectionLabel: { color: '#888', fontWeight: '900', fontSize: 13, letterSpacing: 0.5, marginBottom: 10 },
    favoritesGrid: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
    favBox: { width: 140, aspectRatio: 2 / 3, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
    fullPfpOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 1000, justifyContent: 'center', alignItems: 'center' },
    fullPfpModal: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    fullPfpImg: { width: width * 0.8, height: width * 0.8, borderRadius: width * 0.4, transform: [{ translateY: 60 }] },
    closeBtn: { position: 'absolute', top: 40, right: 20 },
    diarySeasonBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4 },
    diarySeasonText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    epsBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
    epsText: { color: '#888', fontSize: 10, fontWeight: 'bold' },
    diaryDateBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
    diaryDateText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
    globalLoading: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
});
