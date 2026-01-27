import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    Pressable,
    ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/utils/supabase';
import { tmdbApi } from '@/utils/tmdb';
import { getResolvedPosterUrl, getTMDBImageUrl } from '@/utils/poster-resolver';
import PremiumLoader from '@/components/PremiumLoader';
import { X, Share2 } from 'lucide-react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { generateAndShareSticker } from '@/utils/shareUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_SIZE = 1080;

export default function GraphDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser, userData, globalPosters } = useAuth();

    const [details, setDetails] = useState<any>(null);
    const [graphData, setGraphData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const graphRef = useRef(null);

    useEffect(() => {
        const fetchGraphData = async () => {
            if (!currentUser || !id) return;
            try {
                setLoading(true);
                const seriesId = parseInt(id as string);

                const [
                    seriesDetails,
                    reviewRes,
                    diaryRes,
                    ratingRes,
                    watchedRes
                ] = await Promise.all([
                    tmdbApi.getSeriesDetails(seriesId),
                    supabase
                        .from('episode_reviews')
                        .select('season_number, episode_number, rating')
                        .eq('user_id', currentUser.uid)
                        .eq('tmdb_id', seriesId),
                    supabase
                        .from('diary_entries')
                        .select('season_number, episode_number, rating')
                        .eq('user_id', currentUser.uid)
                        .eq('tmdb_id', seriesId),
                    supabase
                        .from('episode_ratings')
                        .select('season_number, episode_number, rating')
                        .eq('user_id', currentUser.uid)
                        .eq('tmdb_id', seriesId),
                    supabase
                        .from('watched_episodes')
                        .select('season_number, episode_number')
                        .eq('user_id', currentUser.uid)
                        .eq('tmdb_id', seriesId)
                ]);

                const userRatings: any = {};
                const watchedSet = new Set();

                // Merge all rating sources (Latest wins)
                [...(reviewRes.data || []), ...(diaryRes.data || []), ...(ratingRes.data || [])].forEach(r => {
                    const key = `${r.season_number}-${r.episode_number}`;
                    if (r.rating !== null && r.rating !== undefined) {
                        userRatings[key] = r.rating;
                        watchedSet.add(key);
                    }
                });

                watchedRes.data?.forEach((w: any) => {
                    watchedSet.add(`${w.season_number}-${w.episode_number}`);
                });

                const today = new Date();
                const sortedSeasons = (seriesDetails.seasons || [])
                    .filter((s: any) => {
                        if (s.season_number === 0) return false;
                        // STRICT: Exclude future seasons so the graph reflects currently aired content only
                        if (s.air_date && new Date(s.air_date) > today) return false;
                        return true;
                    })
                    .sort((a: any, b: any) => a.season_number - b.season_number);

                // Construct Logo (Same logic as index)
                const logos = seriesDetails.images?.logos || [];
                const enLogo = logos.filter((l: any) => l.iso_639_1 === 'en').sort((a: any, b: any) => b.vote_average - a.vote_average)[0]?.file_path
                    || logos.filter((l: any) => !l.iso_639_1).sort((a: any, b: any) => b.vote_average - a.vote_average)[0]?.file_path
                    || logos[0]?.file_path;

                setDetails({
                    ...seriesDetails,
                    logo_path: enLogo
                });

                setGraphData({
                    ratings: userRatings,
                    watched: watchedSet,
                    seasons: sortedSeasons
                });
            } catch (error) {
                console.error('[GraphDetail] Error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchGraphData();
    }, [id, currentUser]);

    const handleShare = async () => {
        try {
            setGenerating(true);
            // Wait a tick for UI to settle
            await new Promise(r => setTimeout(r, 100));
            // Pass the calculated FINAL dimensions to avoid squishing
            await generateAndShareSticker(graphRef, FINAL_WIDTH, FINAL_HEIGHT);
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };

    if (loading) return <PremiumLoader message="Analyzing..." />;
    if (!details || !graphData) return null;

    // Grid Setup (Restored)
    const maxEpisodes = Math.max(...graphData.seasons.map((s: any) => s.episode_count));

    // Resolve Poster (Restored)
    const posterUrl = getResolvedPosterUrl(
        details.id,
        details.poster_path,
        globalPosters,
        'original' // High res for canvas
    );

    const logoUrl = details.logo_path ? getTMDBImageUrl(details.logo_path, 'original') : null;

    // DYNAMIC SCALING LOGIC
    // Base Sizes from Styles
    const BASE_PADDING_V = 240; // 120 top + 120 bottom
    const BASE_PADDING_H = 160; // 80 left + 80 right
    const LEFT_COL_WIDTH = 400;
    const COL_GAP = 100;

    // Right Col Elements
    const RIGHT_COL_PADDING_LEFT = 0; // The vessel itself doesn't have huge padding, internal spacers do.
    const EPISODE_ROW_HEIGHT = 72 + 16; // Height + Gap
    const SEASON_COL_WIDTH = 72 + 16;   // Width + Gap

    const numSeasons = graphData.seasons.length;
    const rightColWidth = 76 + (numSeasons * SEASON_COL_WIDTH); // 76 is the E-label spacer

    const calculatedWidth = 80 + LEFT_COL_WIDTH + COL_GAP + rightColWidth + 80;

    const headerHeight = 130; // Branding area approx
    const labelsHeight = 50;  // S-labels area
    const bodyHeight = maxEpisodes * EPISODE_ROW_HEIGHT;

    const calculatedHeight = 120 + headerHeight + labelsHeight + bodyHeight + 120;

    // Ensure strictly at least 1080 for quality, but expand if needed
    const FINAL_WIDTH = Math.max(1080, calculatedWidth);
    const FINAL_HEIGHT = Math.max(1150, calculatedHeight);

    // Scaling for Preview on Phone Screen
    // We want to fit the FINAL_WIDTH into SCREEN_WIDTH (minus some margin)
    const previewScale = (SCREEN_WIDTH - 20) / FINAL_WIDTH;

    return (
        <View style={styles.container}>


            {/* Canvas Wrapper needs to hold the scaled view centrally */}
            <View style={[styles.canvasWrapper, { height: FINAL_HEIGHT * previewScale + 100 }]}>
                <View
                    style={[
                        styles.scaleContainer,
                        {
                            transform: [{ scale: previewScale }],
                            width: FINAL_WIDTH,
                            height: FINAL_HEIGHT,
                            // transformOrigin is top-left or center? RN default is center.
                            // If center, we might need offset. Let's try centering wrapper.
                        }
                    ]}
                >
                    <ViewShot
                        ref={graphRef}
                        style={[styles.canvas, { width: FINAL_WIDTH, height: FINAL_HEIGHT }]}
                        options={{ format: 'png', quality: 1, width: FINAL_WIDTH, height: FINAL_HEIGHT }}
                    >
                        <View style={styles.posterInnerPayload}>
                            <View style={styles.posterGridAxis}>

                                {/* LEFT COLUMN */}
                                <View style={styles.posterColVessel}>
                                    {/* User Info */}
                                    <View style={styles.userInfoStack}>
                                        <Text style={styles.reviewedByLabel}>reviewed by</Text>
                                        <Text style={styles.handleHighlight}>@{userData?.username || 'user'}</Text>
                                    </View>

                                    {/* Poster */}
                                    <View style={styles.hardSquarePoster}>
                                        <Image
                                            source={{ uri: posterUrl ?? undefined }}
                                            style={styles.rawPosterImg}
                                            contentFit="cover"
                                            cachePolicy="memory-disk"
                                        />
                                    </View>

                                    {/* Title / Logo */}
                                    <View style={styles.titleLogoAnchor}>
                                        {logoUrl ? (
                                            <Image
                                                source={{ uri: logoUrl }}
                                                style={styles.officialTitleCard}
                                                contentFit="contain"
                                                cachePolicy="memory-disk"
                                            />
                                        ) : (
                                            <Text style={styles.titleTextFallback}>{details.name}</Text>
                                        )}
                                    </View>
                                </View>

                                {/* RIGHT COLUMN */}
                                <View style={styles.gridColVessel}>
                                    {/* Branding */}
                                    <View style={styles.brandingHeaderRight}>
                                        <Text style={styles.reviewedOnLabel}>reviewed on</Text>
                                        <Text style={styles.mainLogoBrand}>
                                            <Text style={{ color: '#FFD600' }}>S</Text>
                                            <Text style={{ color: '#fff' }}>ERIEE</Text>
                                        </Text>
                                    </View>

                                    {/* Grid Labels (S1, S2...) */}
                                    <View style={styles.headerLabelsS}>
                                        {/* Spacer to align with E-labels logic? Web uses spacer-e-header width:0. 
                                            Web CSS: .header-labels-s { padding-left: 76px; gap: 16px } 
                                            .grid-body-stack { gap: 16px } 
                                            .e-label-fix { width: 60px; text-align: right }
                                            We need to match the spacing rigidly.
                                        */}
                                        <View style={{ width: 76 }} />
                                        {graphData.seasons.map((s: any) => (
                                            <Text key={s.season_number} style={styles.sLabelFix}>S{s.season_number}</Text>
                                        ))}
                                    </View>

                                    {/* Grid Body */}
                                    <View style={styles.gridBodyStack}>
                                        {Array.from({ length: maxEpisodes }).map((_, eIdx) => (
                                            <View key={eIdx} style={styles.gridRowFlex}>
                                                <Text style={styles.eLabelFix}>E{eIdx + 1}</Text>
                                                {graphData.seasons.map((s: any) => {
                                                    const epNum = eIdx + 1;
                                                    if (epNum > s.episode_count) {
                                                        return <View key={s.season_number} style={[styles.squareCellUnit, styles.emptyCell]} />;
                                                    }

                                                    const rating = graphData.ratings[`${s.season_number}-${epNum}`];
                                                    const isWatched = graphData.watched.has(`${s.season_number}-${epNum}`);

                                                    const ratingVal = rating ? rating.toFixed(1) : (isWatched ? '0.0' : '');

                                                    // Colors (Color-Blind Friendly Scale)
                                                    let bg = '#1a1a1a'; // locked/default
                                                    let txt = '#fff';
                                                    if (rating) {
                                                        txt = '#000'; // All rating text is black
                                                        if (rating >= 4.0) bg = '#1b5e20';      // Dark Green (4-5)
                                                        else if (rating >= 3.5) bg = '#f1c40f'; // Yellow (3.5)
                                                        else if (rating >= 3.0) bg = '#e67e22'; // Orange (3.0)
                                                        else if (rating >= 1.0) bg = '#c62828'; // Red (1.0-2.0)
                                                        else if (rating >= 0.5) bg = '#6a1b9a'; // Purple (0.5)
                                                        else bg = '#9e9e9e';                    // Grey (0.0/nil)
                                                    } else if (isWatched) {
                                                        bg = '#9e9e9e'; // Grey for watched but unrated
                                                        txt = '#000';
                                                    }

                                                    return (
                                                        <View key={s.season_number} style={[styles.squareCellUnit, { backgroundColor: bg }]}>
                                                            <Text style={[styles.cellText, { color: txt }]}>{ratingVal}</Text>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </View>
                        </View>
                    </ViewShot>
                </View>
            </View>

            {/* Actions */}
            <View style={styles.actionPills}>
                <Pressable style={styles.pillBtn} onPress={handleShare}>
                    <Share2 color="#000" size={20} />
                    <Text style={styles.pillText}>Share on Story</Text>
                </Pressable>
            </View>

            {generating && <PremiumLoader message="Preparing Story..." />}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtn: {
        position: 'absolute',
        zIndex: 100,
        left: '50%',
        marginLeft: -16, // Center X
    },
    canvasWrapper: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH, // Make it a square container for the preview (since we scale the 1080x1080 down)
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden' // Clip calls
    },
    scaleContainer: {
        // The View that gets scaled
        position: 'absolute',
        // transform origin is center by default in RN
    },
    canvas: {
        backgroundColor: '#000',
        paddingVertical: 120, // Web: 120px
        paddingHorizontal: 80, // Web: 80px
        alignItems: 'center',
        justifyContent: 'center'
    },
    posterInnerPayload: {
        width: '100%',
        alignItems: 'center',
    },
    posterGridAxis: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 100, // Web: 100px
        width: '100%',
    },
    // LEFT COL
    posterColVessel: {
        width: 400, // Web: flex: 0 0 400px
        alignItems: 'center',
    },
    userInfoStack: {
        alignItems: 'center',
        marginBottom: 25,
    },
    reviewedByLabel: {
        fontSize: 22, // 1.2rem ~ 19-20px. 22px for native legibility at 1080p
        color: '#666',
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 5,
        textTransform: 'lowercase',
    },
    handleHighlight: {
        fontSize: 32, // 1.8rem
        color: '#fff',
        fontWeight: '800',
    },
    hardSquarePoster: {
        width: '100%',
        aspectRatio: 2 / 3,
        backgroundColor: '#111',
        marginBottom: 40,
    },
    rawPosterImg: {
        width: '100%',
        height: '100%',
    },
    titleLogoAnchor: {
        width: '100%',
        minHeight: 120,
        justifyContent: 'center',
        alignItems: 'center',
    },
    officialTitleCard: {
        width: '100%',
        height: 140,
    },
    titleTextFallback: {
        fontSize: 56, // 3.5rem
        color: '#fff',
        textTransform: 'uppercase',
        textAlign: 'center',
        fontFamily: 'Anton-Regular' // Strictly use Anton
    },
    // RIGHT COL
    gridColVessel: {
        paddingTop: 10,
    },
    brandingHeaderRight: {
        alignItems: 'center',
        marginBottom: 40,
        paddingLeft: 60,
    },
    reviewedOnLabel: {
        fontSize: 22, // 1.2rem
        color: '#555',
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 8,
        textTransform: 'lowercase',
    },
    brandLogoHeavy: {
        flexDirection: 'row',
    },
    mainLogoBrand: {
        fontSize: 48,
        fontFamily: 'Anton-Regular',
        letterSpacing: 0,
        lineHeight: 52,
    },
    logoSGold: {
        color: '#FFD600',
        fontSize: 40,
        letterSpacing: 4,
        fontFamily: 'Anton-Regular',
        lineHeight: 46,
    },
    logoTextWhite: {
        color: '#fff',
        fontSize: 40,
        letterSpacing: 4,
        fontFamily: 'Anton-Regular',
        lineHeight: 46,
    },
    headerLabelsS: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 20,
        // paddingLeft handled by spacer view
    },
    sLabelFix: {
        width: 72,
        textAlign: 'center',
        fontFamily: 'Anton-Regular',
        fontSize: 28, // 1.5rem
        color: '#666',
    },
    gridBodyStack: {
        gap: 16,
    },
    gridRowFlex: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    eLabelFix: {
        width: 60,
        textAlign: 'right',
        fontFamily: 'Anton-Regular',
        fontSize: 28, // 1.5rem
        color: '#666',
    },
    squareCellUnit: {
        width: 72,
        height: 72,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyCell: {
        backgroundColor: 'transparent',
    },
    cellText: {
        fontSize: 28,
        fontWeight: '900',
    },
    // ACTIONS
    actionPills: {
        position: 'absolute',
        bottom: 100, // Strict Match Web
    },
    pillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 60,
        gap: 10,
    },
    pillText: {
        color: '#000',
        fontSize: 18,
        fontWeight: '800',
    }
});
