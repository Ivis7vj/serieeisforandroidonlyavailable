import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    Dimensions,
    ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/utils/supabase';
import { tmdbApi } from '@/utils/tmdb';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import { BarChart3 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import PremiumLoader from '@/components/PremiumLoader';

const { width } = Dimensions.get('window');
const GAP = 10;
const PADDING = 10;
// 3 columns: (Screen - (2 * Padding) - (2 * Gap)) / 3
// Subtract 1px to strictly avoid sub-pixel rounding wrapping
const COLUMN_WIDTH = Math.floor((width - (PADDING * 2) - (GAP * 2)) / 3) - 1;

export default function GraphScreen() {
    const { currentUser, globalPosters } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [completedSeries, setCompletedSeries] = useState<any[]>([]);
    const [showConfirm, setShowConfirm] = useState(false);
    const [selectedSeries, setSelectedSeries] = useState<any>(null);

    const fetchCompletedSeries = async () => {
        if (!currentUser) return;
        try {
            setLoading(true);

            // 1. Fetch ALL watched episodes (Source of Truth for now)
            const { data: watchedData, error: watchedError } = await supabase
                .from('watched_episodes')
                .select('tmdb_id, season_number, episode_number')
                .eq('user_id', currentUser.uid);

            if (watchedError) throw watchedError;

            const seriesMap: any = {};
            watchedData?.forEach((item: any) => {
                if (!seriesMap[item.tmdb_id]) {
                    seriesMap[item.tmdb_id] = { tmdb_id: item.tmdb_id, watched: [] };
                }
                seriesMap[item.tmdb_id].watched.push(item);
            });

            const completed: any[] = [];
            const today = new Date().toISOString().split('T')[0];

            // 2. Check each series for completion (Filtering by Aired Content)
            for (const id of Object.keys(seriesMap)) {
                try {
                    const seriesId = parseInt(id);
                    const details = await tmdbApi.getSeriesDetails(seriesId);
                    if (!details) continue;

                    const regularSeasons = (details.seasons || []).filter((s: any) => s.season_number > 0);

                    // Filter seasons that have actually AIRED
                    const airedSeasons = regularSeasons.filter((s: any) => {
                        return s.air_date && s.air_date <= today && s.episode_count > 0;
                    });

                    if (airedSeasons.length === 0) continue;

                    let isAllCompleted = true;
                    for (const season of airedSeasons) {
                        const watchedInSeason = seriesMap[seriesId].watched.filter((w: any) => w.season_number === season.season_number);
                        if (watchedInSeason.length < season.episode_count) {
                            isAllCompleted = false;
                            break;
                        }
                    }

                    if (isAllCompleted) {
                        const logos = details.images?.logos || [];
                        const enLogo = logos.filter((l: any) => l.iso_639_1 === 'en').sort((a: any, b: any) => b.vote_average - a.vote_average)[0]?.file_path
                            || logos.filter((l: any) => !l.iso_639_1).sort((a: any, b: any) => b.vote_average - a.vote_average)[0]?.file_path
                            || logos[0]?.file_path;

                        completed.push({
                            id: seriesId,
                            name: details.name,
                            poster_path: details.poster_path,
                            logo_path: enLogo,
                        });
                    }
                } catch (err) {
                    console.error(`Skipping series ${id}:`, err);
                }
            }

            setCompletedSeries(completed);
        } catch (err) {
            console.error("Error fetching completed series:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompletedSeries();
    }, [currentUser]);

    const handlePosterClick = (series: any) => {
        setSelectedSeries(series);
        setShowConfirm(true);
    };

    const handleGenerate = () => {
        setShowConfirm(false);
        if (selectedSeries) {
            router.push(`/series-graph/${selectedSeries.id}` as any);
        }
    };

    if (loading) return <PremiumLoader message="Loading library..." />;

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {completedSeries.length === 0 ? (
                    <View style={styles.emptyState}>
                        <BarChart3 color="#666" size={64} style={{ opacity: 0.5 }} />
                        <Text style={styles.emptyText}>No completed series found.</Text>
                    </View>
                ) : (
                    <View style={styles.grid}>
                        {completedSeries.map((series) => {
                            // Resolve Poster using global utility + context
                            const posterUrl = getResolvedPosterUrl(
                                series.id,
                                series.poster_path,
                                globalPosters,
                                'w342'
                            );

                            return (
                                <Pressable
                                    key={series.id}
                                    style={({ pressed }) => [
                                        styles.card,
                                        { transform: [{ scale: pressed ? 0.96 : 1 }] }
                                    ]}
                                    onPress={() => handlePosterClick(series)}
                                >
                                    <View style={styles.posterContainer}>
                                        <Image
                                            source={{ uri: posterUrl ?? undefined }}
                                            style={styles.poster}
                                            contentFit="cover"
                                            transition={200}
                                        />
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {showConfirm && selectedSeries && (
                <View style={styles.modalOverlay}>
                    <View style={styles.confirmModal}>
                        <View style={styles.modalText}>
                            <Text style={styles.modalHeader}>GENERATE GRAPH?</Text>
                            <Text style={styles.modalSeriesName}>{selectedSeries.name}</Text>
                        </View>
                        <View style={styles.modalActions}>
                            <Pressable style={styles.generateBtn} onPress={handleGenerate}>
                                <Text style={styles.generateBtnText}>GENERATE</Text>
                            </Pressable>
                            <Pressable style={styles.cancelBtn} onPress={() => setShowConfirm(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        paddingTop: 0,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    pageTitle: {
        color: '#FFD600', // var(--accent-color)
        fontSize: 42, // ~2.8rem
        fontWeight: '900', // Anton-like
        letterSpacing: 2,
        marginBottom: 5,
        fontFamily: 'System', // Fallback, normally custom font
        textAlign: 'center'
    },
    pageSubtitle: {
        color: '#666',
        fontSize: 15,
        textAlign: 'center',
    },
    scrollContent: {
        paddingBottom: 40,
        // alignItems: 'center' // REMOVED to allow full width for grid left alignment
    },
    // Homepage Style Match
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start', // Start from left
        gap: GAP,
        paddingHorizontal: PADDING,
        paddingBottom: 20,
        width: '100%',
    },
    card: {
        width: COLUMN_WIDTH,
        marginBottom: 8,
    },
    posterContainer: {
        width: COLUMN_WIDTH,
        height: COLUMN_WIDTH / (115 / 170), // Maintain Homepage Aspect Ratio
        borderRadius: 6, // Match Homepage Radius
        overflow: 'hidden',
        backgroundColor: '#111',
        borderWidth: 1, // Match Homepage Border
        borderColor: '#222', // Match Homepage Border
        marginBottom: 8,
        elevation: 8, // Match Homepage Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    poster: {
        width: '100%',
        height: '100%',
    },
    seriesName: {
        color: '#ccc',
        fontSize: 11, // Slightly smaller to fit narrow width
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 14
    },
    emptyState: {
        marginTop: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: '#fff',
        marginTop: 20,
        fontSize: 16
    },
    // Modal
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        zIndex: 5000,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmModal: {
        backgroundColor: '#000',
        width: 300,
        borderWidth: 1,
        borderColor: '#222',
        padding: 30,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    modalText: {
        marginBottom: 25,
        alignItems: 'center'
    },
    modalHeader: {
        color: '#888',
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: 1,
        marginBottom: 8,
        textTransform: 'uppercase'
    },
    modalSeriesName: {
        color: '#fff',
        fontSize: 24, // 1.6rem
        fontWeight: '800',
        lineHeight: 28,
        textAlign: 'center'
    },
    modalActions: {
        width: '100%',
        gap: 15
    },
    generateBtn: {
        width: '100%',
        padding: 16,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    generateBtnText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    cancelBtn: {
        width: '100%',
        padding: 16,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#333',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '700'
    }
});
