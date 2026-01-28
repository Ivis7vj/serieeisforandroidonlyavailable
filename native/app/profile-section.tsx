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
    TouchableOpacity,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { ArrowLeft, Star, Share, X, AlertCircle } from 'lucide-react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import ViewShot, { captureRef } from 'react-native-view-shot';

import ExportConfigPopup from '@/components/diary-export/ExportConfigPopup';
import ShareMenuPopup from '@/components/diary-export/ShareMenuPopup';
import DiaryPosterTemplate from '@/components/diary-export/DiaryPosterTemplate';
import * as shareUtils from '@/utils/share-utils';

import { useAuth } from '@/context/auth-context';
import { db } from '@/utils/firebase';
import { collection, query, where, orderBy, limit, getDocs, startAfter, doc, getDoc } from 'firebase/firestore';
import { getUserProfileData } from '@/utils/profile-service';
import ActivityFeed from '@/components/activity-feed';
import { getUserReviews } from '@/utils/review-service';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import { triggerSelection } from '@/utils/haptics';
import ReviewItem from '@/components/series/ReviewItem';
import DiaryDetailDrawer from '@/components/diary/DiaryDetailDrawer';
import { supabase } from '@/utils/supabase';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const GAP = 10;
const PADDING = 0;
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
                        {(() => {
                            const [y, m, d] = item.date.split('-');
                            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
                        })()}
                    </Text>
                </View>
            )}
        </Pressable>
    );
};

export default function ProfileSectionScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { uid, type } = useLocalSearchParams();
    const { currentUser } = useAuth();
    const targetUid = uid as string;
    const sectionType = type as string;
    const highlightExport = useLocalSearchParams().highlightExport === 'true'; // Check param
    const isOwnProfile = targetUid === currentUser?.uid;

    const [profileData, setProfileData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Diary Drawer State
    const [selectedEntry, setSelectedEntry] = useState<any>(null);

    // Export State
    const [showExportConfig, setShowExportConfig] = useState(false);
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [showEmptyError, setShowEmptyError] = useState(false);
    const [isTemplateLoaded, setIsTemplateLoaded] = useState(false);
    const templateRef = React.useRef<ViewShot>(null);

    // Reviews Pagination
    const [reviews, setReviews] = useState<any[]>([]);
    const [lastReview, setLastReview] = useState<any>(null);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [hasMoreReviews, setHasMoreReviews] = useState(true);
    const [userList, setUserList] = useState<any[]>([]);
    const [loadingUserList, setLoadingUserList] = useState(false);

    // REVIEWS FETCH (Direct Supabase)
    const fetchProfileReviews = useCallback(async () => {
        if (!targetUid) return;
        setLoadingReviews(true);
        try {
            const data = await getUserReviews(targetUid);
            const mapped = data.map((item: any) => ({
                id: item.id,
                userId: targetUid,
                userName: profileData?.userInfo?.username || item.userName || 'User',
                photoURL: profileData?.userInfo?.photoURL || item.photoURL,
                rating: item.rating,
                review: item.review,
                seriesName: item.seriesName || item.name,
                poster_path: item.poster_path,
                seasonNumber: item.seasonNumber,
                episodeNumber: item.episodeNumber,
                isEpisode: !!item.isEpisode,
                tmdbId: item.tmdbId,
                date: item.createdAt || new Date().toISOString(),
                createdAt: item.createdAt || new Date().toISOString()
            }));

            // Explicit Sort: Newest First
            mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            setReviews(mapped);
        } catch (error) {
            console.error("Failed to fetch profile reviews:", error);
        } finally {
            setLoadingReviews(false);
        }
    }, [targetUid, profileData?.userInfo]);


    useEffect(() => {
        // Event Listener
        const { reviewEvents } = require('@/utils/review-events');

        const onReviewChange = ({ type, data }: { type: string, data: any }) => {
            console.log('[ProfileSection] Real-time Review Event:', type, data?.id);
            if (sectionType === 'Reviews') {
                if (type === 'create') handleRealtimeChange({ eventType: 'INSERT', new: data }, data.isEpisode ? 'episode' : 'season');
                if (type === 'update') handleRealtimeChange({ eventType: 'UPDATE', new: data }, data.isEpisode ? 'episode' : 'season');
                if (type === 'delete') handleRealtimeChange({ eventType: 'DELETE', old: data }, data.isEpisode ? 'episode' : 'season'); // old needs id
            } else if (sectionType === 'Diary') {
                // For Diary, we might need to reload or manually patch.
                // Ideally patch `profileData.diary`
                if (type === 'create' || type === 'update') {
                    // Optimistic logic for Diary is complex due to sorting/grouping. 
                    // Simplest robust way: Trigger loadData but silent
                    loadData(true);
                }
                if (type === 'delete') {
                    handleEntryDelete(data.id);
                }
            }
        };

        reviewEvents.on('review_change', onReviewChange);

        if (sectionType === 'Reviews') {
            fetchProfileReviews();
            // Keep Supabase as backup (omitted for brevity in this replace block if effectively replaced, but usually good to keep)
            // ... [Existing Supabase Logic] ...
        }

        return () => {
            reviewEvents.off('review_change', onReviewChange);
        };
    }, [targetUid, sectionType, fetchProfileReviews]);

    const handleRealtimeChange = (payload: any, type: 'season' | 'episode') => {
        if (payload.eventType === 'INSERT') {
            const newItem = normalizeReview(payload.new, type);
            setReviews(prev => [newItem, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
            const updatedItem = normalizeReview(payload.new, type);
            setReviews(prev => prev.map(r => r.id === updatedItem.id ? { ...r, ...updatedItem } : r));
        } else if (payload.eventType === 'DELETE') {
            setReviews(prev => prev.filter(r => r.id !== payload.old.id));
        }
    };

    const normalizeReview = (r: any, type: 'season' | 'episode') => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name || 'User',
        photoURL: r.photo_url,
        rating: r.rating?.toString(),
        review: r.review_text,
        seriesName: r.series_name,
        poster_path: r.poster_path,
        seasonNumber: r.season_number,
        episodeNumber: r.episode_number,
        isEpisode: type === 'episode',
        tmdbId: r.tmdb_id,
        date: r.created_at || new Date().toISOString(),
        createdAt: r.created_at || new Date().toISOString()
    });

    const fetchUserList = async (uids: string[]) => {
        if (!uids || uids.length === 0) return;
        setLoadingUserList(true);
        try {
            const fetched = await Promise.all(uids.slice(0, 50).map(async (uid) => {
                const snap = await getDoc(doc(db, 'users', uid));
                if (snap.exists()) return { ...snap.data(), uid };
                return null;
            }));
            setUserList(fetched.filter(u => u !== null));
        } catch (e) {
            console.error("Error fetching user list:", e);
        } finally {
            setLoadingUserList(false);
        }
    };

    const loadData = useCallback(async (isRefreshing = false) => {
        if (!targetUid) return;
        if (!isRefreshing) setLoading(true);
        try {
            const data = await getUserProfileData(targetUid);
            setProfileData(data);

            if (sectionType === 'Reviews') {
                fetchProfileReviews();
            } else if (sectionType === 'Followers') {
                fetchUserList(data?.userInfo?.followers || []);
            } else if (sectionType === 'Following') {
                fetchUserList(data?.userInfo?.following || []);
            }
        } catch (error) {
            console.error("Failed to load profile data:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [targetUid, sectionType]);

    const { useFocusEffect } = require('expo-router');
    useFocusEffect(
        useCallback(() => {
            loadData(true);
        }, [loadData])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData(true);
    };

    const getDiaryGroups = () => {
        if (!profileData?.diary) return {};
        const groups: { [key: string]: any[] } = {};

        // Sort strictly by date descending
        const sorted = [...profileData.diary].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        sorted.forEach(item => {
            if (!item.date) return;
            const [y, m, d] = item.date.split('-');
            if (!y || !m || !d) return;

            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const monthKey = `${months[parseInt(m) - 1]} ${y}`;
            if (!groups[monthKey]) groups[monthKey] = [];

            // Grouping Logic: Unique per Series+Season in this Month
            const existingIndex = groups[monthKey].findIndex(g =>
                (String(g.tmdbId) === String(item.tmdbId)) &&
                Number(g.seasonNumber) === Number(item.seasonNumber)
            );

            if (existingIndex > -1) {
                // Merge
                const existing = groups[monthKey][existingIndex];

                const existingEps = existing.episodeCount || (existing.isEpisode ? 1 : 0);
                const currentEps = item.isEpisode ? 1 : 0;

                groups[monthKey][existingIndex] = {
                    ...existing, // Keep newest (sorted)
                    episodeCount: existingEps + currentEps,
                    isSeason: existing.isSeason || item.isSeason,
                };
            } else {
                groups[monthKey].push({
                    ...item,
                    episodeCount: item.isEpisode ? 1 : undefined
                });
            }
        });
        return groups;
    };

    const processWatchlist = (list: any[]) => {
        const groups: { [key: string]: any } = {};
        list.forEach(item => {
            if (item.seasonNumber !== undefined && item.seasonNumber !== null && item.episodeNumber !== undefined) {
                const key = `${item.seriesId || item.id}_S${item.seasonNumber}`;
                if (!groups[key]) {
                    groups[key] = {
                        type: 'basket',
                        seriesId: item.seriesId || item.id,
                        seasonNumber: item.seasonNumber,
                        name: item.name,
                        poster_path: item.poster_path,
                        seasonPoster: item.seasonPoster,
                        episodes: []
                    };
                }
                groups[key].episodes.push(item);
            }
        });
        const processed: any[] = [];
        list.forEach(item => {
            if (item.seasonNumber !== undefined && item.episodeNumber !== undefined) return;
            if (item.seasonNumber !== undefined) {
                const basketKey = `${item.seriesId || item.id}_S${item.seasonNumber}`;
                if (groups[basketKey]) return;
            }
            processed.push({ ...item, type: 'series' });
        });
        Object.values(groups).forEach((basket: any) => {
            basket.episodeCount = basket.episodes.length;
            processed.push(basket);
        });
        return processed;
    };

    // REAL-TIME UPDATE HANDLERS
    // REAL-TIME UPDATE HANDLERS
    const handleEntryUpdate = (updatedEntry: any) => {
        // Update Local Reviews List (if looking at reviews)
        if (sectionType === 'Reviews') {
            setReviews(prev => prev.map(item =>
                item.id === updatedEntry.id ? { ...item, ...updatedEntry } : item
            ));
        }

        if (!profileData || !profileData.diary) return;

        // 1. Update Diary List (Supabase Source)
        const newDiary = profileData.diary.map((item: any) =>
            item.id === updatedEntry.id ? updatedEntry : item
        );
        setProfileData({ ...profileData, diary: newDiary });
    };

    const handleEntryDelete = (entryId: string) => {
        if (sectionType === 'Reviews') {
            setReviews(prev => prev.filter(item => item.id !== entryId));
        }

        if (!profileData || !profileData.diary) return;

        // 1. Update Diary List
        const newDiary = profileData.diary.filter((item: any) => item.id !== entryId);
        setProfileData({ ...profileData, diary: newDiary });
    };

    const [reviewFilter, setReviewFilter] = useState<'ALL' | 'SEASON' | 'EPISODE'>('ALL');

    const renderHeader = () => (
        <View style={[styles.header, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <ArrowLeft color="#FFF" size={28} />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>{sectionType}</Text>
            </View>

            {sectionType === 'Reviews' && (
                <View style={styles.filterRow}>
                    {(['All', 'Season', 'Episode'] as const).map((label) => {
                        const type = label.toUpperCase() as 'ALL' | 'SEASON' | 'EPISODE';
                        const isActive = reviewFilter === type;
                        return (
                            <TouchableOpacity
                                key={type}
                                onPress={() => setReviewFilter(type)}
                                style={[styles.filterBtn, isActive && styles.filterBtnActive]}
                            >
                                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            {sectionType === 'Diary' && isOwnProfile && (
                <View style={{ position: 'relative', flexDirection: 'row', alignItems: 'center' }}>
                    {/* Tooltip helper */}
                    {highlightExport && (
                        <Animated.View
                            entering={FadeInRight}
                            style={styles.exportTooltip}
                        >
                            <Text style={styles.exportTooltipText}>Export now</Text>
                            <View style={styles.exportTooltipArrow} />
                        </Animated.View>
                    )}
                    <TouchableOpacity
                        onPress={() => setShowExportConfig(true)}
                        style={styles.exportBtn}
                    >
                        <Share color="#FFCC00" size={24} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    const renderContent = () => {
        if (loading && !profileData) return <ActivityIndicator color="#FFCC00" size="large" style={{ marginTop: 50 }} />;
        if (!profileData) return null;

        const { diary, watchlist, likes, userPosters } = profileData;

        switch (sectionType) {
            case 'Reviews':
                const filteredReviews = reviews.filter(r => {
                    if (reviewFilter === 'SEASON') return !r.isEpisode;
                    if (reviewFilter === 'EPISODE') return r.isEpisode;
                    return true;
                });

                if (filteredReviews.length === 0) return <Text style={styles.emptyText}>No reviews found.</Text>;

                return (
                    <View style={styles.content}>
                        <View style={{ paddingHorizontal: 0 }}>
                            {filteredReviews.map((review) => (
                                <ReviewItem
                                    key={review.id}
                                    review={review}
                                    renderStars={(rating: number, size: number) => {
                                        const stars = [];
                                        const score = rating;
                                        for (let i = 1; i <= 5; i++) {
                                            const isFull = score >= i;
                                            const isHalf = score >= i - 0.5 && score < i;
                                            stars.push(
                                                <View key={i} style={{ position: 'relative' }}>
                                                    <FontAwesome
                                                        name={isFull ? "star" : (isHalf ? "star-half-full" : "star-o")}
                                                        size={size}
                                                        color={isFull || isHalf ? "#FFCC00" : "#333"}
                                                    />
                                                </View>
                                            );
                                        }
                                        return <View style={{ flexDirection: 'row', gap: 2 }}>{stars}</View>;
                                    }}
                                    isMe={review.userId === currentUser?.uid}
                                    onPress={() => setSelectedEntry(review)} // Open Drawer instead of Navigating
                                />
                            ))}
                            {/* Load More Button Removed */}
                        </View>
                    </View>
                );

            case 'Diary': {
                const groups = getDiaryGroups();
                if (Object.keys(groups).length === 0) return <Text style={styles.emptyText}>No entries yet.</Text>;
                return (
                    <View style={styles.content}>
                        {Object.keys(groups).map(key => (
                            <View key={key} style={styles.diaryGroup}>
                                <Text style={styles.diaryMonthHeader}>{key}</Text>
                                <View style={[styles.grid, { paddingHorizontal: 0 }]}>
                                    {groups[key].map((item, idx) => {
                                        const cleanName = item.name?.replace(/\s*\(Season \d+\)$/, '');
                                        return (
                                            <View key={idx} style={{ width: TILE_SIZE, marginBottom: 20 }}>
                                                <PosterGridItem
                                                    item={item}
                                                    onPress={() => setSelectedEntry(item)}
                                                    showBadges
                                                    userPosters={userPosters}
                                                />
                                                <View style={{ marginTop: 8 }}>
                                                    <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }} numberOfLines={1}>{cleanName}</Text>
                                                    {item.seasonNumber && (
                                                        <Text style={{ color: '#888', fontSize: 9, fontWeight: 'bold' }}>SEASON {item.seasonNumber}</Text>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        ))}
                    </View>
                );
            }

            case 'Activity':
                return (
                    <View style={styles.content}>
                        <View style={{ paddingHorizontal: 0 }}>
                            <ActivityFeed
                                userId={targetUid}
                                feed={profileData.activityPreview}
                                variant="profile"
                            />
                        </View>
                    </View>
                );

            case 'Tracking': {
                const watchlistItems = processWatchlist(watchlist);
                if (watchlistItems.length === 0) return <Text style={styles.emptyText}>Watchlist is empty.</Text>;
                return (
                    <View style={[styles.grid, { paddingHorizontal: 0 }]}>
                        {watchlistItems.map((item, idx) => (
                            <View key={idx} style={{ marginBottom: 10 }}>
                                <PosterGridItem
                                    item={item}
                                    onPress={() => {
                                        if (item.type === 'basket') {
                                            router.push(`/watchlist/season/${item.seriesId}/${item.seasonNumber}`);
                                        } else {
                                            const route = `/series/${item.id || item.tmdbId}`;
                                            if (item.seasonNumber) {
                                                router.push({ pathname: route, params: { seasonNumber: item.seasonNumber } } as any);
                                            } else {
                                                router.push(route as any);
                                            }
                                        }
                                    }}
                                    showBadges
                                    userPosters={userPosters}
                                />
                            </View>
                        ))}
                    </View>
                );
            }

            case 'Liked': {
                const validLikes = likes.filter((l: any) => l.type !== 'like_review');
                if (validLikes.length === 0) return <Text style={styles.emptyText}>No likes yet.</Text>;
                return (
                    <View style={[styles.grid, { paddingHorizontal: 0 }]}>
                        {validLikes.map((item: any, idx: number) => (
                            <View key={idx} style={{ marginBottom: 10 }}>
                                <PosterGridItem
                                    item={item}
                                    onPress={() => {
                                        const route = `/series/${item.tmdbId}`;
                                        if (item.seasonNumber) {
                                            router.push({ pathname: route, params: { seasonNumber: item.seasonNumber } } as any);
                                        } else {
                                            router.push(route as any);
                                        }
                                    }}
                                    showBadges
                                    userPosters={userPosters}
                                />
                            </View>
                        ))}
                    </View>
                );
            }

            case 'Followers':
            case 'Following':
                if (loadingUserList) return <ActivityIndicator color="#FFCC00" style={{ marginTop: 20 }} />;
                if (userList.length === 0) return <Text style={styles.emptyText}>No users found.</Text>;
                return (
                    <View style={[styles.content, { paddingHorizontal: 16 }]}>
                        {userList.map((user) => (
                            <TouchableOpacity
                                key={user.uid}
                                style={styles.userItem}
                                onPress={() => router.push(`/public-profile/${user.uid}`)}
                            >
                                <View style={styles.userAvatar}>
                                    {user.photoURL ? (
                                        <Image source={{ uri: user.photoURL }} style={styles.userAvatarImg} />
                                    ) : (
                                        <Text style={styles.userInitial}>{user.username?.charAt(0).toUpperCase()}</Text>
                                    )}
                                </View>
                                <Text style={styles.userListUsername}>{user.username}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                );

            default: return null;
        }
    };

    const handleExportConfirm = (month: number, year: number) => {
        const entries = profileData?.diary?.filter((item: any) => {
            const d = new Date(item.date);
            return d.getMonth() === month && d.getFullYear() === year;
        }) || [];

        if (entries.length === 0) {
            setShowExportConfig(false);
            setShowEmptyError(true);
            return;
        }

        setSelectedMonth(month);
        setSelectedYear(year);
        setShowExportConfig(false);
        setExportLoading(true);
        setIsTemplateLoaded(false);
    };

    const captureDiary = useCallback(async () => {
        if (!templateRef.current) return;
        try {
            const uri = await captureRef(templateRef, {
                format: 'png',
                quality: 1,
                result: 'tmpfile'
            });
            setGeneratedImage(uri);
            setShowShareMenu(true);
        } catch (e) {
            console.error("Capture Error:", e);
        } finally {
            setExportLoading(false);
        }
    }, []);

    useEffect(() => {
        let timeout: any;
        if (exportLoading) {
            if (isTemplateLoaded) {
                captureDiary();
            } else {
                timeout = setTimeout(() => {
                    console.warn("Template timeout: Forcing capture");
                    captureDiary();
                }, 5000);
            }
        }
        return () => clearTimeout(timeout);
    }, [exportLoading, isTemplateLoaded, captureDiary]);

    const getFilteredEntries = () => {
        if (selectedMonth === null || selectedYear === null || !profileData?.diary) return [];
        return profileData.diary.filter((item: any) => {
            const d = new Date(item.date);
            return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        }).map((item: any) => {
            // Robustly resolve the TMDB default path
            const rawPoster = item.seasonPoster || item.season_poster_path || item.poster_path || item.posterPath;

            return {
                ...item,
                resolvedPoster: getResolvedPosterUrl(
                    String(item.tmdbId),
                    rawPoster,
                    profileData.userPosters,
                    'w342', // Higher quality for export
                    item.seasonNumber,
                    true,
                    true
                )
            };
        });
    };

    return (
        <View style={styles.container}>
            {renderHeader()}
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFCC00" />}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {renderContent()}
            </ScrollView>

            <ExportConfigPopup
                visible={showExportConfig}
                onClose={() => setShowExportConfig(false)}
                onConfirm={handleExportConfirm}
            />

            <ShareMenuPopup
                visible={showShareMenu}
                imageUri={generatedImage}
                onClose={() => setShowShareMenu(false)}
                onDownload={() => generatedImage && shareUtils.saveToGallery(generatedImage)}
                onInstagram={() => generatedImage && shareUtils.shareToInstagram(generatedImage)}
                onWhatsApp={() => generatedImage && shareUtils.shareToWhatsApp(generatedImage)}
                onMore={() => generatedImage && shareUtils.shareNative(generatedImage)}
            />

            <View style={styles.offscreenContainer} pointerEvents="none">
                {selectedMonth !== null && selectedYear !== null && (
                    <DiaryPosterTemplate
                        ref={templateRef}
                        month={[
                            'January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'
                        ][selectedMonth]}
                        year={selectedYear}
                        user={{
                            username: profileData?.userInfo?.username || 'User',
                            photoURL: profileData?.userInfo?.photoURL
                        }}
                        entries={getFilteredEntries()}
                        onImageLoad={() => setIsTemplateLoaded(true)}
                    />
                )}
            </View>

            {exportLoading && (
                <View style={styles.globalLoading}>
                    <ActivityIndicator size="large" color="#FFCC00" />
                </View>
            )}

            {showEmptyError && (
                <View style={styles.errorOverlay}>
                    <View style={[styles.landscapePopup, { backgroundColor: '#FFC107', width: 300 }]}>
                        <View style={styles.popupHeader}>
                            <Text style={styles.errorTitle}>OOPS!</Text>
                        </View>

                        <Text style={styles.errorText}>No series found for this date</Text>

                        <Pressable
                            style={styles.errorOkBtn}
                            onPress={() => setShowEmptyError(false)}
                        >
                            <Text style={styles.errorOkBtnText}>OK</Text>
                        </Pressable>
                    </View>
                </View>
            )}

            <DiaryDetailDrawer
                visible={!!selectedEntry}
                entry={selectedEntry}
                onClose={() => setSelectedEntry(null)}
                onUpdate={handleEntryUpdate}
                onDelete={handleEntryDelete}
                userPosters={profileData?.userPosters}
            />
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        height: 100,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
        backgroundColor: '#000',
    },
    backBtn: {
        padding: 5,
        marginRight: 15,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: 1,
    },
    content: { paddingVertical: 16 },
    // Filter Styles
    filterRow: { flexDirection: 'row', marginLeft: 'auto', gap: 8, marginRight: 15 },
    filterBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, borderWidth: 1, borderColor: '#333' },
    filterBtnActive: { borderColor: '#FFCC00', backgroundColor: 'rgba(255, 204, 0, 0.1)' },
    filterText: { color: '#666', fontSize: 11, fontWeight: '700' },
    filterTextActive: { color: '#FFCC00' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, justifyContent: 'flex-start' },
    diaryGroup: { marginBottom: 25 },
    diaryMonthHeader: { color: '#888', fontWeight: '900', marginBottom: 15, fontSize: 16, paddingHorizontal: 16 },
    emptyText: { color: '#444', textAlign: 'center', marginTop: 40, paddingHorizontal: 16 },
    loadMoreBtn: { padding: 15, alignItems: 'center', backgroundColor: '#111', borderRadius: 8, marginTop: 10 },
    loadMoreText: { color: '#FFCC00', fontWeight: '900', fontSize: 12 },
    diarySeasonBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4 },
    diarySeasonText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    epsBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
    epsText: { color: '#888', fontSize: 10, fontWeight: 'bold' },
    diaryDateBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
    diaryDateText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
    exportBtn: {
        marginLeft: 'auto',
        padding: 10,
    },
    offscreenContainer: {
        position: 'absolute',
        top: 0,
        left: 2000,
        opacity: 0.01,
    },
    globalLoading: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    errorOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
    },
    landscapePopup: {
        borderRadius: 24,
        paddingVertical: 18,
        paddingHorizontal: 15,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10
    },
    closeModalBtn: {
        position: 'absolute',
        top: 10,
        right: 10,
        padding: 5,
        zIndex: 10
    },
    popupHeader: {
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 8,
        gap: 4
    },
    errorTitle: {
        color: '#000',
        fontSize: 18,
        fontFamily: 'ArchivoBlack-Regular',
        textAlign: 'center'
    },
    errorText: {
        color: '#000',
        fontSize: 12,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 15,
        paddingHorizontal: 10,
        lineHeight: 18
    },
    errorOkBtn: {
        backgroundColor: '#000',
        paddingVertical: 10,
        paddingHorizontal: 40,
        borderRadius: 30,
        alignItems: 'center'
    },
    errorOkBtnText: {
        color: '#FFC107',
        fontSize: 14,
        fontFamily: 'ArchivoBlack-Regular'
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#111',
    },
    userAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#111',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        overflow: 'hidden',
    },
    userAvatarImg: {
        width: '100%',
        height: '100%',
    },
    userInitial: {
        color: '#444',
        fontSize: 18,
        fontWeight: 'bold',
    },
    userListUsername: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: 'bold',
    },

    exportTooltip: { position: 'absolute', right: 50, backgroundColor: '#FFCC00', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, zIndex: 99, flexDirection: 'row', alignItems: 'center' },
    exportTooltipText: { color: '#000', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
    exportTooltipArrow: { position: 'absolute', right: -6, top: 8, width: 0, height: 0, borderTopWidth: 6, borderTopColor: 'transparent', borderBottomWidth: 6, borderBottomColor: 'transparent', borderLeftWidth: 6, borderLeftColor: '#FFCC00' }
});
