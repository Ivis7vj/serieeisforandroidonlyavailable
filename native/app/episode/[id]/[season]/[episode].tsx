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
    Platform,
    Animated
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
    AlertTriangle,
    Check,
    Plus,
    Eye,
    EyeOff
} from 'lucide-react-native';
import { ReportReviewModals } from '@/components/review/ReportReviewModals';

import { useAuth } from '@/context/auth-context';
import { tmdbApi } from '@/utils/tmdb';
import * as reviewService from '@/utils/review-service';
import * as watchedService from '@/utils/watched-service';
import * as watchlistService from '@/utils/watchlist-service';
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
    const [expanded, setExpanded] = useState(false);
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [selectedReviewForReport, setSelectedReviewForReport] = useState<any>(null);
    const [isWatched, setIsWatched] = useState(false);
    const [isListed, setIsListed] = useState(false);

    const scrollY = useRef(new Animated.Value(0)).current;

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

                // CHECK STATUS
                if (currentUser) {
                    const watchedEps = await watchedService.getWatchedEpisodes(currentUser.uid, tmdbId);
                    const isW = watchedEps.some((e: any) => e.season === seasonNum && e.episode === episodeNum);
                    setIsWatched(isW);

                    const isL = await watchlistService.isInWatchlist(currentUser.uid, epData.id); // epData.id is unique episode ID
                    setIsListed(isL);
                }

                setLoading(false);
            } catch (e) {
                console.error("Episode fetch failed", e);
                setLoading(false);
            }
        };
        fetchAll();
    }, [tmdbId, seasonNum, episodeNum, currentUser]);

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

    const toggleWatched = async () => {
        if (!currentUser) return;
        triggerSelection();
        const oldVal = isWatched;
        setIsWatched(!oldVal);

        if (oldVal) {
            await watchedService.unmarkEpisodeWatched(currentUser.uid, tmdbId, seasonNum, episodeNum);
        } else {
            await watchedService.markEpisodeWatched(currentUser.uid, tmdbId, seasonNum, episodeNum);
            // Verify strict rule: If adding to watched, usually we remove from watchlist?
            // User asked for "add the watched and the wathlist and the watched button"
            // Assuming independent toggles unless specified otherwise.
            // But traditionally, watching removes from watchlist.
            if (isListed) {
                setIsListed(false);
                await watchlistService.removeFromWatchlist(currentUser.uid, data.id);
            }
        }
    };

    const toggleListed = async () => {
        if (!currentUser) return;
        triggerSelection();
        const oldVal = isListed;
        setIsListed(!oldVal);

        if (oldVal) {
            await watchlistService.removeFromWatchlist(currentUser.uid, data.id);
        } else {
            const itemToSave = {
                id: data.id,
                name: `${data.name} - S${seasonNum}E${episodeNum}`,
                poster_path: data.still_path,
                vote_average: data.vote_average,
                first_air_date: data.air_date,
                type: 'episode',
                seriesId: tmdbId,
                seasonNumber: seasonNum,
                episodeNumber: episodeNum
            };
            await watchlistService.addToWatchlist(currentUser.uid, itemToSave);
        }
    };

    const backdropUrl = data.still_path
        ? `https://image.tmdb.org/t/p/original${data.still_path}`
        : null;

    const avgRating = reviews.length > 0
        ? (reviews.reduce((acc, r) => acc + (parseFloat(r.rating) || 0), 0) / reviews.length).toFixed(1)
        : "0.0";

    return (
        <View style={styles.container}>


            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
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
                        colors={['transparent', 'rgba(0,0,0,0.5)', '#000']}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.heroInfo}>
                        <Text style={styles.heroTitle} numberOfLines={2}>{data.name}</Text>
                        <Text style={styles.heroSubtitle}>Season {seasonNum} • Episode {episodeNum}</Text>
                    </View>
                </View>

                <View style={styles.statsActionsBar}>
                    <View style={styles.statsCol}>
                        <View style={styles.statItem}>
                            <Star size={18} color="#FFC107" fill="#FFC107" />
                            <Text style={styles.statVal}>{avgRating}</Text>
                        </View>
                    </View>

                    <View style={styles.actionsRow}>
                        <Pressable
                            style={[styles.actionBtn, isWatched && styles.actionBtnActive]}
                            onPress={toggleWatched}
                        >
                            {isWatched ? <Check size={20} color="#000" /> : <Eye size={20} color="#FFC107" />}
                            <Text style={[styles.actionBtnText, isWatched && styles.actionBtnTextActive]}>
                                {isWatched ? 'WATCHED' : 'WATCH'}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={[styles.actionBtn, isListed && styles.actionBtnActive]}
                            onPress={toggleListed}
                        >
                            {isListed ? <Check size={20} color="#000" /> : <Plus size={20} color="#FFC107" />}
                            <Text style={[styles.actionBtnText, isListed && styles.actionBtnTextActive]}>
                                {isListed ? 'LISTED' : 'LIST'}
                            </Text>
                        </Pressable>
                    </View>
                </View>

                {/* META INFO */}
                <View style={styles.metaSection}>
                    <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>AIR DATE</Text>
                        <Text style={styles.metaValue}>
                            {data.air_date ? new Date(data.air_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                        </Text>
                    </View>
                    {data.runtime && (
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>RUNTIME</Text>
                            <Text style={styles.metaValue}>{data.runtime} MIN</Text>
                        </View>
                    )}
                </View>

                {/* OVERVIEW */}
                <View style={styles.overviewSection}>
                    <Text style={styles.sectionTitle}>OVERVIEW</Text>
                    <Pressable onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpanded(!expanded); }}>
                        <Text style={styles.overview} numberOfLines={expanded ? undefined : 4}>
                            {data.overview || "No overview available for this episode."}
                        </Text>
                        {data.overview && data.overview.length > 200 && (
                            <Text style={styles.readMore}>{expanded ? 'SHOW LESS' : 'READ MORE'}</Text>
                        )}
                    </Pressable>
                </View>

                {/* CAST */}
                {allCast.length > 0 && (
                    <View style={styles.castSection}>
                        <Text style={[styles.sectionTitle, { paddingHorizontal: 20 }]}>CAST & CREW</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 20, gap: 15 }}
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

                {/* REVIEWS SECTION */}
                <View style={styles.reviewsSection}>
                    <View style={styles.reviewsHeader}>
                        <Text style={styles.sectionTitle}>COMMUNITY</Text>
                        <Pressable
                            style={styles.rateBtn}
                            onPress={() => {
                                router.push({
                                    pathname: '/review',
                                    params: {
                                        type: 'episode',
                                        id: tmdbId,
                                        season: seasonNum,
                                        episode: episodeNum,
                                        name: `${data.name}`,
                                        poster_path: data.still_path
                                    }
                                } as any);
                            }}
                        >
                            <Text style={styles.rateBtnText}>RATE</Text>
                        </Pressable>
                    </View>

                    {reviews.length > 0 ? (
                        reviews.map((rev, idx) => (
                            <View key={idx} style={styles.reviewCard}>
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
                                        <Star size={14} color="#FFC107" fill="#FFC107" />
                                        <Text style={styles.ratingText}>{rev.rating}</Text>
                                    </View>
                                </View>
                                {rev.review ? <Text style={styles.reviewBody}>{rev.review}</Text> : null}
                                <View style={styles.revBottom}>
                                    <Text style={styles.revDate}>
                                        {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : 'Recent'}
                                    </Text>
                                    {rev.userId !== currentUser?.uid && (
                                        <Pressable
                                            onPress={() => {
                                                setSelectedReviewForReport(rev);
                                                setReportModalVisible(true);
                                            }}
                                        >
                                            <AlertTriangle size={14} color="#cc0000" />
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>NO REVIEWS YET</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

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

            <View style={[styles.header, { paddingTop: insets.top }]}>
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                    <ArrowLeft color="white" size={28} />
                </Pressable>
            </View>
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
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        paddingHorizontal: 15,
        height: 100,
        justifyContent: 'center'
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    hero: {
        width: '100%',
        height: 300,
        position: 'relative'
    },
    heroInfo: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20
    },
    heroTitle: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: 'bold',
        lineHeight: 36
    },
    heroSubtitle: {
        color: '#FFC107',
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 5
    },
    statsActionsBar: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#000',
        borderBottomWidth: 1,
        borderBottomColor: '#111'
    },
    statsCol: {
        flex: 1
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    statVal: {
        color: '#FFF',
        fontSize: 26,
        fontWeight: 'bold'
    },
    statLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        fontWeight: 'bold',
        marginTop: 2
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 10
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 25,
        backgroundColor: '#000',
        borderWidth: 2,
        borderColor: '#FFC107'
    },
    actionBtnActive: {
        backgroundColor: '#FFC107'
    },
    actionBtnText: {
        color: '#FFC107',
        fontSize: 12,
        fontWeight: 'bold'
    },
    actionBtnTextActive: {
        color: '#000'
    },
    metaSection: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 15,
        gap: 30
    },
    metaItem: {
        gap: 4
    },
    metaLabel: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 10,
        fontWeight: 'bold'
    },
    metaValue: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold'
    },
    overviewSection: {
        paddingHorizontal: 20,
        marginTop: 10
    },
    sectionTitle: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 15,
        letterSpacing: 1
    },
    overview: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 15,
        lineHeight: 24
    },
    readMore: {
        color: '#FFC107',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 10
    },
    castSection: {
        marginTop: 30
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
        backgroundColor: '#000',
        marginBottom: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#111'
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
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        textAlign: 'center'
    },
    reviewsSection: {
        marginTop: 40,
        paddingHorizontal: 20
    },
    reviewsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    rateBtn: {
        backgroundColor: '#FFF',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20
    },
    rateBtnText: {
        color: '#000',
        fontSize: 12,
        fontWeight: 'bold'
    },
    reviewCard: {
        backgroundColor: '#000',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#111',
        marginBottom: 15
    },
    revTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16
    },
    userName: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold'
    },
    ratingText: {
        color: '#FFC107',
        fontSize: 14,
        fontWeight: 'bold'
    },
    reviewBody: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        lineHeight: 22
    },
    revBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 15
    },
    revDate: {
        color: 'rgba(255,255,255,0.2)',
        fontSize: 12
    },
    emptyState: {
        paddingVertical: 40,
        alignItems: 'center'
    },
    emptyText: {
        color: 'rgba(255,255,255,0.1)',
        fontSize: 14,
        fontWeight: 'bold'
    }
});
