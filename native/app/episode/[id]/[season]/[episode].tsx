import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Dimensions,
    Pressable,
    ActivityIndicator,
    LayoutAnimation,
    Platform
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    Star,
    User,
    MessageSquare,
    Share as ShareIcon,
    AlertTriangle
} from 'lucide-react-native';
import { ReportReviewModals } from '@/components/review/ReportReviewModals';

import { useAuth } from '@/context/auth-context';
import { tmdbApi } from '@/utils/tmdb';
import * as reviewService from '@/utils/review-service';
import { triggerSelection } from '@/utils/haptics';
import { db } from '@/utils/firebase';
import { doc, getDoc } from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function EpisodeDetailsScreen() {
    const { id, season, episode } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser } = useAuth();

    const [data, setData] = useState<any>(null);
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0); // 0: Details, 1: Reviews
    const [expanded, setExpanded] = useState(false);
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [selectedReviewForReport, setSelectedReviewForReport] = useState<any>(null);
    const pagerRef = useRef<ScrollView>(null);

    const tmdbId = parseInt(id as string);
    const seasonNum = parseInt(season as string);
    const episodeNum = parseInt(episode as string);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                // Fetch Episode
                const epData = await tmdbApi.fetchDirect(
                    `/tv/${tmdbId}/season/${seasonNum}/episode/${episodeNum}`,
                    '&append_to_response=credits,images,videos,guest_stars'
                );
                setData(epData);

                // Fetch Reviews
                const revs = await reviewService.getEpisodeReviews(tmdbId, seasonNum, episodeNum);

                // FORCE FETCH USER DATA (Photo/Name) from Firebase
                const enrichedRevs = await Promise.all(revs.map(async (r: any) => {
                    if (r.userId) {
                        try {
                            const userSnap = await getDoc(doc(db, 'users', r.userId));
                            if (userSnap.exists()) {
                                const userData = userSnap.data();
                                return {
                                    ...r,
                                    photoURL: userData.photoURL || r.photoURL,
                                    userName: userData.username || userData.displayName || r.userName
                                };
                            }
                        } catch (err) {
                            console.log("User fetch err", err);
                        }
                    }
                    return r;
                }));

                setReviews(enrichedRevs);
                setLoading(false);
            } catch (e) {
                console.error("Episode fetch failed", e);
                setLoading(false);
            }
        };
        fetchAll();
    }, [tmdbId, seasonNum, episodeNum]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFCC00" />
            </View>
        );
    }

    if (!data) return null;

    const allCast = [
        ...(data.guest_stars || []),
        ...(data.credits?.cast || [])
    ];

    const backdropUrl = data.still_path
        ? `https://image.tmdb.org/t/p/original${data.still_path}`
        : null;

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#000', '#111']}
                style={StyleSheet.absoluteFill}
            />

            {/* HERO SECTION */}
            <View style={styles.hero}>
                {backdropUrl && (
                    <Image
                        source={{ uri: backdropUrl }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                    />
                )}
                <LinearGradient
                    colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', '#000']}
                    style={StyleSheet.absoluteFill}
                />

                {/* Header Row */}
                <View style={[styles.headerRow, { paddingTop: insets.top }]}>
                    <Pressable
                        style={styles.backBtn}
                        onPress={() => router.back()}
                    >
                        <ArrowLeft color="white" size={28} />
                    </Pressable>

                </View>
            </View>

            <View style={styles.contentContainer}>
                {/* TABS */}
                <View style={styles.tabs}>
                    <Pressable
                        style={[styles.tabItem, activeTab === 0 && styles.tabActive]}
                        onPress={() => {
                            triggerSelection();
                            setActiveTab(0);
                            pagerRef.current?.scrollTo({ x: 0, animated: true });
                        }}
                    >
                        <Text style={[styles.tabText, activeTab === 0 && styles.tabTextActive]}>Episode Details</Text>
                        {activeTab === 0 && <View style={styles.activeLine} />}
                    </Pressable>
                    <Pressable
                        style={[styles.tabItem, activeTab === 1 && styles.tabActive]}
                        onPress={() => {
                            triggerSelection();
                            setActiveTab(1);
                            pagerRef.current?.scrollTo({ x: width, animated: true });
                        }}
                    >
                        <Text style={[styles.tabText, activeTab === 1 && styles.tabTextActive]}>Reviews ({reviews.length})</Text>
                        {activeTab === 1 && <View style={styles.activeLine} />}
                    </Pressable>
                </View>

                {/* TAB PAGER (Parity: Swipeable) */}
                <ScrollView
                    ref={pagerRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => {
                        const newTab = Math.round(e.nativeEvent.contentOffset.x / width);
                        if (newTab !== activeTab) {
                            setActiveTab(newTab);
                        }
                    }}
                    scrollEventThrottle={16}
                >
                    {/* SECTION 1: DETAILS */}
                    <ScrollView style={{ width: width }} contentContainerStyle={{ paddingBottom: 100, width: '100%' }}>
                        <View style={styles.section}>
                            <View style={{ paddingHorizontal: 20 }}>
                                <Text style={styles.title}>{data.name}</Text>
                                <View style={styles.metaRow}>
                                    <Text style={styles.metaText}>S{seasonNum} E{episodeNum}</Text>
                                    <Text style={styles.dot}>•</Text>
                                    <Text style={styles.metaText}>{data.air_date?.substring(0, 4)}</Text>
                                    {data.runtime && (
                                        <>
                                            <Text style={styles.dot}>•</Text>
                                            <Text style={styles.metaText}>{data.runtime}min</Text>
                                        </>
                                    )}
                                </View>

                                <Pressable onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpanded(!expanded); }}>
                                    <Text style={styles.overview} numberOfLines={expanded ? undefined : 4}>
                                        {data.overview || "No overview available for this episode."}
                                    </Text>
                                    {data.overview && data.overview.length > 200 && (
                                        <Text style={styles.readMore}>{expanded ? 'Show less' : 'Read more'}</Text>
                                    )}
                                </Pressable>
                            </View>

                            {/* CAST */}
                            {allCast.length > 0 && (
                                <View style={styles.castSection}>
                                    <Text style={[styles.secTitle, { paddingHorizontal: 20 }]}>CAST & CREW</Text>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={{ paddingHorizontal: 20, gap: 15 }}
                                        nestedScrollEnabled={true}
                                    >
                                        {allCast.map((c: any) => (
                                            <Pressable
                                                key={`${c.id}-${c.character}`}
                                                style={styles.castCard}
                                                onPress={() => router.push(`/person/${c.id}`)}
                                            >
                                                <View style={styles.castImgBox}>
                                                    {c.profile_path ? (
                                                        <Image source={{ uri: `https://image.tmdb.org/t/p/w200${c.profile_path}` }} style={styles.castImg} />
                                                    ) : (
                                                        <User color="#444" size={30} />
                                                    )}
                                                </View>
                                                <Text style={styles.castName} numberOfLines={1}>{c.name}</Text>
                                                <Text style={styles.castChar} numberOfLines={1}>{c.character || c.job}</Text>
                                            </Pressable>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}
                        </View>
                    </ScrollView>

                    {/* SECTION 2: REVIEWS */}
                    <ScrollView style={{ width: width }} contentContainerStyle={{ paddingBottom: 100, width: '100%' }}>
                        <View style={styles.section}>
                            <View style={[styles.revHeader, { paddingHorizontal: 20 }]}>
                                <Text style={styles.secTitle}>Community Reviews</Text>
                                {(() => {
                                    const userReview = reviews.find(r => r.userId === currentUser?.uid);
                                    const isRated = !!userReview;

                                    return (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <Pressable
                                                style={[styles.rateBtn, isRated && { backgroundColor: '#333', borderWidth: 1, borderColor: '#FFCC00' }]}
                                                onPress={() => {
                                                    router.push({
                                                        pathname: '/review',
                                                        params: {
                                                            type: 'episode',
                                                            id: tmdbId,
                                                            season: seasonNum,
                                                            episode: episodeNum,
                                                            name: `S${seasonNum}E${episodeNum}: ${data.name}`,
                                                            poster_path: data.still_path
                                                        }
                                                    } as any);
                                                }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Star size={16} color={isRated ? "#FFCC00" : "#000"} fill={isRated ? "#FFCC00" : "transparent"} />
                                                    <Text style={[styles.rateBtnText, isRated && { color: '#FFCC00' }]}>{isRated ? 'RATED' : 'RATE'}</Text>
                                                </View>
                                            </Pressable>

                                            {isRated && (
                                                <Pressable
                                                    style={[styles.rateBtn, { backgroundColor: '#222', paddingHorizontal: 10 }]}
                                                    onPress={() => {
                                                        triggerSelection();
                                                        const stickerDataToPass = {
                                                            movie: {
                                                                id: tmdbId,
                                                                name: data.name,
                                                                poster_path: data.still_path,
                                                                seasonEpisode: `S${seasonNum} E${episodeNum}`
                                                            },
                                                            rating: userReview.rating,
                                                            user: currentUser ? {
                                                                username: currentUser.displayName || 'User',
                                                                photoURL: currentUser.photoURL || undefined
                                                            } : null,
                                                            isEpisodes: true,
                                                            seasonCompleted: false,
                                                            resolvedPoster: data.still_path
                                                        };
                                                        router.push({
                                                            pathname: '/share-sticker',
                                                            params: { data: JSON.stringify(stickerDataToPass) }
                                                        });
                                                    }}
                                                >
                                                    <ShareIcon size={16} color="#FFF" />
                                                </Pressable>
                                            )}
                                        </View>
                                    );
                                })()}
                            </View>

                            {reviews.length > 0 ? (
                                reviews.map((rev, idx) => (
                                    <View key={idx} style={[styles.reviewCard, { marginHorizontal: 20 }]}>
                                        <View style={styles.revTop}>
                                            <Pressable
                                                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                                                onPress={() => {
                                                    if (rev.userId === currentUser?.uid) {
                                                        router.push('/(tabs)/profile');
                                                    } else {
                                                        router.push(`/public-profile/${rev.userId}`);
                                                    }
                                                }}
                                            >
                                                <Image
                                                    source={{ uri: rev.photoURL || `https://ui-avatars.com/api/?name=${rev.userName}&background=random` }}
                                                    style={styles.avatar}
                                                />
                                                <Text style={styles.userName}>{rev.userName}</Text>
                                            </Pressable>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Star size={14} color="#FFD600" fill="#FFD600" />
                                                <Text style={styles.ratingText}>{rev.rating}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.reviewBody}>{rev.review}</Text>
                                        <View style={styles.revBottomRow}>
                                            <Text style={styles.date}>{rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : 'Recent'}</Text>

                                            <View style={styles.revActionsRight}>
                                                {/* Report Button */}
                                                {rev.userId !== currentUser?.uid && (
                                                    <Pressable
                                                        style={styles.reportBtnSmall}
                                                        onPress={() => {
                                                            setSelectedReviewForReport(rev);
                                                            setReportModalVisible(true);
                                                        }}
                                                    >
                                                        <AlertTriangle size={15} color="#cc0000" strokeWidth={3} />
                                                    </Pressable>
                                                )}

                                                {/* Indicator Badge */}
                                                <View style={styles.indicatorBadge}>
                                                    <Text style={styles.indicatorText}>
                                                        {rev.isEpisode ? 'EPISODE' : 'SEASON'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <View style={styles.emptyState}>
                                    <MessageSquare size={40} color="#444" style={{ marginBottom: 10 }} />
                                    <Text style={{ color: '#666' }}>No reviews yet.</Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </ScrollView>
            </View>

            <ReportReviewModals
                visible={reportModalVisible}
                onClose={() => {
                    setReportModalVisible(false);
                    setSelectedReviewForReport(null);
                }}
                activity={selectedReviewForReport ? {
                    user_name: selectedReviewForReport.userName,
                    user_id: selectedReviewForReport.userId,
                    series_name: selectedReviewForReport.seriesName || (data.name ? `S${seasonNum}E${episodeNum}: ${data.name}` : 'Episode Detail'),
                    season_number: selectedReviewForReport.seasonNumber,
                    review_text: selectedReviewForReport.review
                } : null}
                reporterData={{
                    username: currentUser?.displayName || 'User',
                    email: currentUser?.email ?? ''
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center'
    },
    hero: {
        width: '100%',
        height: 250,
        position: 'relative'
    },
    headerRow: {
        width: '100%',
        minHeight: Platform.OS === 'ios' ? 100 : 56, // Changed height to minHeight
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10, // Keep padding
        borderBottomWidth: 0, // Removed border for cleaner look overlay
        zIndex: 100,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    contentContainer: {
        flex: 1,
        backgroundColor: '#000',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden'
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        marginBottom: 20
    },
    tabItem: {
        flex: 1,
        paddingVertical: 15,
        alignItems: 'center',
        position: 'relative'
    },
    tabActive: {
        // Active state style if needed
    },
    tabText: {
        color: '#666',
        fontWeight: 'bold',
        fontSize: 14,
        textTransform: 'uppercase'
    },
    tabTextActive: {
        color: '#FFF'
    },
    activeLine: {
        position: 'absolute',
        bottom: 0,
        width: '40%',
        height: 3,
        backgroundColor: '#FFD600',
        borderRadius: 2
    },
    section: {
        // Removed paddingHorizontal to allow carousels to bleed
    },
    title: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        flexWrap: 'wrap', // Fix: Allow wrapping if text is too long
        gap: 6 // Add gap for wrapped items
    },
    metaText: {
        color: '#AAA',
        fontSize: 14
    },
    dot: {
        color: '#444',
        marginHorizontal: 8
    },
    overview: {
        color: '#CCC',
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 5
    },
    readMore: {
        color: '#FFD600',
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 5,
        marginBottom: 20
    },
    castSection: {
        marginTop: 20
    },
    secTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 15,
        textTransform: 'uppercase'
    },
    castCard: {
        width: 80,
        alignItems: 'center'
    },
    castImgBox: {
        width: 70,
        height: 70,
        borderRadius: 35,
        overflow: 'hidden',
        backgroundColor: '#111',
        marginBottom: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#222'
    },
    castImg: {
        width: '100%',
        height: '100%'
    },
    castName: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: 'bold',
        textAlign: 'center'
    },
    castChar: {
        color: '#666',
        fontSize: 10,
        textAlign: 'center'
    },
    revHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    rateBtn: {
        backgroundColor: '#FFD600',
        paddingVertical: 6,
        paddingHorizontal: 15,
        borderRadius: 20
    },
    rateBtnText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 12
    },
    reviewCard: {
        backgroundColor: '#0a0a0a',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 15
    },
    revBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 10
    },
    revActionsRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    reportBtnSmall: {
        padding: 4,
        marginRight: -4,
    },
    indicatorBadge: {
        backgroundColor: '#1a1a1a',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#222'
    },
    indicatorText: {
        color: '#888',
        fontSize: 9,
        fontWeight: 'bold',
        textTransform: 'uppercase'
    },
    revTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10
    },
    avatar: {
        width: 30,
        height: 30,
        borderRadius: 15
    },
    userName: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14
    },
    ratingText: {
        color: '#FFD600',
        fontWeight: 'bold',
        fontSize: 14
    },
    reviewBody: {
        color: '#CCC',
        fontSize: 14,
        lineHeight: 20
    },
    date: {
        color: '#444',
        fontSize: 12,
        marginTop: 10
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40
    }
});
