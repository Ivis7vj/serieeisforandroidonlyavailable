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
import { Image } from 'expo-image';
import { ArrowLeft, Star, Share } from 'lucide-react-native';
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
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import { triggerSelection } from '@/utils/haptics';
import ReviewItem from '@/components/series/ReviewItem';

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
        return getResolvedPosterUrl(seriesId, rawPoster, userPosters, 'w342', item.seasonNumber);
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

export default function ProfileSectionScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { uid, type } = useLocalSearchParams();
    const { currentUser } = useAuth();
    const targetUid = uid as string;
    const sectionType = type as string;
    const isOwnProfile = targetUid === currentUser?.uid;

    const [profileData, setProfileData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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

    const fetchReviews = async (isInitial = false) => {
        if (!targetUid || (loadingReviews && !isInitial)) return;
        setLoadingReviews(true);
        try {
            let q = query(
                collection(db, 'reviews'),
                where('userId', '==', targetUid),
                orderBy('createdAt', 'desc'),
                limit(10)
            );

            if (!isInitial && lastReview) {
                q = query(q, startAfter(lastReview));
            }

            const snap = await getDocs(q);
            const fetched = snap.docs.map(d => ({ ...d.data(), id: d.id }));

            if (fetched.length < 10) setHasMoreReviews(false);
            setLastReview(snap.docs[snap.docs.length - 1]);

            if (isInitial) {
                setReviews(fetched);
            } else {
                setReviews(prev => [...prev, ...fetched]);
            }
        } catch (e) {
            console.error("Error fetching reviews:", e);
        } finally {
            setLoadingReviews(false);
        }
    };

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
                fetchReviews(true);
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
    }, [targetUid, sectionType, lastReview, loadingReviews]);

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
        const sorted = [...profileData.diary].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        sorted.forEach(item => {
            const date = new Date(item.date);
            const key = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
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

    const renderHeader = () => (
        <View style={[styles.header, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <ArrowLeft color="#FFF" size={28} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{sectionType}</Text>
            {sectionType === 'Diary' && isOwnProfile && (
                <TouchableOpacity
                    onPress={() => setShowExportConfig(true)}
                    style={styles.exportBtn}
                >
                    <Share color="#FFCC00" size={24} />
                </TouchableOpacity>
            )}
        </View>
    );

    const renderContent = () => {
        if (loading && !profileData) return <ActivityIndicator color="#FFCC00" size="large" style={{ marginTop: 50 }} />;
        if (!profileData) return null;

        const { diary, watchlist, likes, userPosters } = profileData;

        switch (sectionType) {
            case 'Reviews':
                return (
                    <View style={styles.content}>
                        <View style={{ paddingHorizontal: 0 }}>
                            {reviews.map((review) => (
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
                                                    <Star size={size} color={isFull || isHalf ? "#FFCC00" : "#333"} fill={isFull ? "#FFCC00" : "transparent"} strokeWidth={2} />
                                                    {isHalf && (
                                                        <View style={{ position: 'absolute', top: 0, left: 0, width: size / 2, overflow: 'hidden' }}>
                                                            <Star size={size} color="#FFCC00" fill="#FFCC00" strokeWidth={2} />
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        }
                                        return <View style={{ flexDirection: 'row', gap: 2 }}>{stars}</View>;
                                    }}
                                    isMe={review.userId === currentUser?.uid}
                                />
                            ))}
                            {hasMoreReviews && (
                                <TouchableOpacity style={styles.loadMoreBtn} onPress={() => fetchReviews()} disabled={loadingReviews}>
                                    {loadingReviews ? <ActivityIndicator size="small" color="#FFCC00" /> : <Text style={styles.loadMoreText}>LOAD MORE</Text>}
                                </TouchableOpacity>
                            )}
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
                                                    onPress={() => {
                                                        const route = `/series/${item.tmdbId || item.id}`;
                                                        if (item.seasonNumber) {
                                                            router.push({ pathname: route, params: { seasonNumber: item.seasonNumber } } as any);
                                                        } else {
                                                            router.push(route as any);
                                                        }
                                                    }}
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
        }).map((item: any) => ({
            ...item,
            resolvedPoster: getResolvedPosterUrl(
                String(item.tmdbId),
                item.posterPath,
                profileData.userPosters,
                'w342',
                item.seasonNumber
            )
        }));
    };

    return (
        <View style={styles.container}>
            {renderHeader()}
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFCC00" />}
                contentContainerStyle={{ paddingBottom: 100 }}
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
                <View style={styles.globalLoading}>
                    <View style={styles.errorModal}>
                        <Text style={styles.errorText}>Oops! No series found for this date</Text>
                        <TouchableOpacity
                            style={styles.errorBtn}
                            onPress={() => setShowEmptyError(false)}
                        >
                            <Text style={styles.errorBtnText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
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
    diaryDateBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
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
    errorModal: {
        width: '80%',
        backgroundColor: '#1a1a1a',
        padding: 30,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    errorText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 25,
        lineHeight: 28,
    },
    errorBtn: {
        backgroundColor: '#FFCC00',
        paddingHorizontal: 40,
        paddingVertical: 12,
        borderRadius: 25,
    },
    errorBtnText: {
        color: '#000',
        fontWeight: '900',
        fontSize: 14,
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
});
