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
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { db } from '@/utils/firebase';
import { doc, updateDoc, collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { getUserProfileData } from '@/utils/profile-service';
import ActivityFeed from '@/components/activity-feed';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import { triggerSelection, triggerImpact } from '@/utils/haptics';
import { followUser, unfollowUser, isFollowingUser } from '@/utils/follow-service';
import ReviewItem from '@/components/series/ReviewItem';
import ProfileHeader from '@/components/ProfileHeader';

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
                                    source={{ uri: getResolvedPosterUrl(String(fav.id || fav.tmdbId), fav.poster_path, undefined, 'w342') || undefined }}
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

                {/* New Strict Profile Header */}
                <ProfileHeader
                    user={user}
                    isOwnProfile={isOwnProfile}
                    isFollowing={isFollowing}
                    followLoading={followLoading}
                    onFollowToggle={handleFollowToggle}
                    onEditBanner={() => isOwnProfile && router.push('/banner-search')}
                    onShowPFP={() => setShowFullPFP(true)}
                />

                <View style={styles.wrapper}>
                    <View style={styles.detailsArea}>
                        {/* Bio First (Below Name) - Same as Profile.tsx */}
                        {user?.bio ? (
                            <Text style={styles.bio}>{user.bio}</Text>
                        ) : null}

                        {/* Stats Below Bio - Left Aligned */}
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
                                        params: { uid: targetUid, type: 'Following' }
                                    } as any);
                                }}
                            >
                                <Text style={styles.statNum}>{user?.following?.length || 0}</Text>
                                <Text style={styles.statLabel}>FOLLOWING</Text>
                            </TouchableOpacity>

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
    detailsArea: { paddingHorizontal: 16, marginTop: 5 },
    wrapper: { width: '100%', zIndex: 10, marginTop: 10 },
    statsContainer: { flexDirection: 'row', gap: 24, marginBottom: 15, justifyContent: 'flex-start' },
    statBox: { alignItems: 'center' },
    statNum: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    statLabel: { color: '#666', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
    bio: { color: '#CCC', fontSize: 14, lineHeight: 20, textAlign: 'left', marginTop: 0 },
    tabsNav: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#222', marginTop: 20, marginBottom: 20, width: '100%' },
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
